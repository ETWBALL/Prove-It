import { ProofType, ProofTypeOrigin } from "@prove-it/db";
import { buildQuestionPrompt } from "./ml/composePrompt";
import { callGeminiQuestionAnalysis } from "./ml/gemini";
import { enforceQuestionAnalysisPolicy } from "./ml/enforceResponsePolicy";
import { buildPromptContext } from "./ml/promptContext";
import {
    AnalysisPhase,
    AnalysisStatusPayload,
    ComposedPrompt,
    CourseLemma,
    Delta,
    DOCUMENT_ANALYSIS_STATUS_EVENT,
    DOCUMENT_STATE_UPDATED_EVENT,
    EmitToDocument,
    HotDocumentState,
    Lemma,
    QuestionAnalysisResponse,
    SelectedLemma,
    Target,
    UserDefinedLemma,
    MathStatement,
    SelectedMathStatement,
    UserDefinedMathStatement,
    CourseMathStatement,
} from "./types";
import { type DeltaValidationCode, validateDeltaForContent } from "./validateDelta";
import { GlobalLibraryRegistry } from "./globalLibraryRegistry";

// TIMERS durations
const LEMMA_TIMER_DURATION_MS = 10_000; // 10 seconds



// DELTA DB Thresholds
const QUESTION_DELTA_THRESHOLD = 50;
const BODY_DELTA_THRESHOLD = 30;
const DISCONNECT_GRACE_MS = 30_000;

// DELTA CONTENT BOUNDS
const MAX_DELTA_CONTENT_LENGTH = 50_000;
const MAX_DOCUMENT_LENGTH = 1_000_000;

// TODO make sure you have put appropriate emits everywhere

// TODO ask cursor or vscode to put semicolons and fix spacing/formatting everywhere
export class DocumentOrchestrator {
    /**
     * === Responsibilities ===
     * (1) Mutates a single instance of HotDocumentState.
     * (2) Each mutation is a method
     * (3) Invariant evaluation: Before every mutating document's state, evaluate invariants
     * (4) Handles asynchronous interactions with ML services. Runs using MLTriggerManager
     * 
     * === Private Attributes ===
     * - state: The single source of truth for document state in RAM. Mutated by orchestrator methods and broadcasted to clients on every change.
     * - timers: Manages scheduling and cancellation of asynchronous tasks.
     * - emit: Socket.IO emit with document room already bound (Registry Option A).
     * - analysisRunId: Bumped on abort / new ML run; clients ignore stale analysis events.
     * - deltas: Keeps track of the number of deltas received for both question and body to determine when to persist to the database.
     * - timers: Maps a composite key of <userId, docId> to its active timer. Enables efficient lookup and cancellation.
     */ 
    #state: HotDocumentState;
    #emit: EmitToDocument;
    #analysisRunId = 0;
    #qAbortController: AbortController | null = null;
    #bAbortController: AbortController | null = null;
    deltas: {question: number, body: number} = {question: 0, body: 0}; 
    #timers: {
        grace: NodeJS.Timeout | null; // One-shot countdown for disconnect grace period
        autosave: NodeJS.Timeout | null; // Interval for periodic autosave
        mlQuestion: NodeJS.Timeout | null; // Sliding window debounce for ML triggers (Question text)
        mlBody: NodeJS.Timeout | null; // Sliding window debounce for ML triggers (Body text)
        lemma: NodeJS.Timeout | null; // Sliding window debounce for lemma generation triggers
    } = {
        grace: null,
        autosave: null,
        mlQuestion: null,
        mlBody: null,
        lemma: null,
        
    };


    // TODO implement this
    
    constructor(initialState: HotDocumentState, emit: EmitToDocument) {
        /**
         * One orchestrator per document workspace. Do not call directly from event handlers —
         * use Registry.#createOrchestrator when loading or joining a document.
         *
         * - `initialState`: Hot RAM snapshot for this document (from DB on join).
         * - `emit`: Bound Socket.IO emit for this document's room only (Registry Option A).
         *   Pass the result of Registry.#bindEmit(documentPublicId), not BroadcastToDocument.
         */

        this.#state = initialState;
        this.#emit = emit;
    }

    public getState(): HotDocumentState {
        /**
         * Simply return the current hotdocument state
         */
        return this.#state;
    }

    public broadcastDocumentState(): void {
        /**
         * Push the full current HotDocumentState to every client in this document's room.
         *
         * Parameters: none (reads this.#state).
         *
         * When to call: After any mutation that clients must reflect (settings, proof type,
         * math statements, lemmas, ML result written into state, etc.).
         *
         * Event: `document:state:updated` with payload = entire HotDocumentState.
         * Do not use for loading-bar UI — use broadcastAnalysisStatus for that.
         */
        this.#emit(DOCUMENT_STATE_UPDATED_EVENT, this.#state);
    }

    public broadcastAnalysisStatus(phase: AnalysisPhase): void {
        /**
         * Push ephemeral ML pipeline progress for the status bar (small payload).
         *
         * - `phase`: One of idle | checking | analyzing | aborted (see AnalysisPhase).
         *   Pass `"checking"` when gates start, `"analyzing"` when ML HTTP starts,
         *   `"idle"` when done with no error, `"aborted"` is also sent from abortMLPipeline.
         *
         * When to call: During requestAnalysis / ML flow — not after every doc field change.
         * Includes current `#analysisRunId` so clients can ignore stale events.
         *
         * Event: `document:analysis:status` with AnalysisStatusPayload.
         * Does not replace broadcastDocumentState — send both when ML updates provability in state.
         */
        const payload: AnalysisStatusPayload = {
            phase,
            runId: this.#analysisRunId,
        };
        this.#emit(DOCUMENT_ANALYSIS_STATUS_EVENT, payload);
    }

    // TODO implement this
    public finalizeMemoryState(contentId: string, persistedErrors: ErrorState[], clearBodyBuffer: boolean, clearQuestionBuffer: boolean): void {
        /**
         * (1) Finalize the in-memory document state after an edit or a question. This includes:
         * - Moving content from buffers to the main body or question list
         * - Updating error states based on ML feedback
         * - Clearing buffers if specified
         * - Broadcasting the updated state to clients
         */
    }

    // ==== Lemma Management ====

    public getSelectedLemma(lemmaPublicId: string): SelectedLemma | undefined {
        /**
         * Given some <lemmaPublicId>, return the corresponding <SelectedLemma> object in the document state.
         * Return undefined if the lemma is not in the document state.
         */
        return this.#state.question.selectedLemmas.find(selectedLemma => selectedLemma.ref.publicId === lemmaPublicId);
    }

    public lemmaOrigin(lemma: Lemma): "user-defined" | "course" {
        /**
         * Return the type of lemma. 
         * Return "user-defined" if the lemma is a user-defined lemma.
         * Return "course" if the lemma is a course lemma.
         */
        return lemma.kind;
    }

    public isLemmaInDocumentState(lemma: Lemma): boolean {
        /**
         * Check if <lemma> is in document state as a <SelectedLemma> object.
         * Return true if it is, false otherwise.
         */

        // Compare reference publicId
        return this.#state.question.selectedLemmas.some(selectedLemma => selectedLemma.ref.publicId === lemma.publicId);
    }

    // TODO implement this
    public addLemma(newLemma: Lemma): void {
        /**
         * Add lemma to document state. <newLemma> is either a user-defined or a course lemma.
         */

        // (1) Check if the lemma is already added
        if (this.isLemmaInDocumentState(newLemma)) {
            throw new Error(`Lemma ${newLemma.publicId} already in document state.`);
        }

        if (newLemma.kind === "user-defined") {
            this.#addUserDefinedLemma(newLemma);
        }

        else {
            this.#addCourseLemma(newLemma);
        }
    }

    #addUserDefinedLemma(newLemma: UserDefinedLemma): void {
        /**
         * <newlemma> is a user-defined lemma. It has no concept of textbook, order index, or course.
         * 
         * === Precondition === 
         * newLemma must already be in the database with a valid publicID.
         */

        const newSelectedLemma: SelectedLemma = {
            lemmaStatus: "INCOMPLETE",
            lemmaManualOverride: false,
            hintContent: null,
            wasUsed: false,
            sufficient: "INSUFFICIENT",
            resolvedAt: null,
            dismissedAt: null,
            ref: {
                source: "user-defined",
                publicId: newLemma.publicId,
            },
        };

        this.#state.question.selectedLemmas.push(newSelectedLemma);
    }

    #addCourseLemma(newLemma: CourseLemma): void{
        /**
         * <newLemma> is a course lemma. <CourseLemma> interface contains extra fields
         * <newLemma> is completely new. It does not have a <lemmaStatus> or <lemmaManualOverride> fields yet.
         * 
         * === Preconditions === 
         * newLemma must already be in the database <Lemma> table with a valid publicID.
         */

        // (1) Pull the lemma from the global library registry. This is because lemma is stored in the global library already
        const reference = GlobalLibraryRegistry.getLemma(newLemma.coursePublicId, newLemma.publicId);
        if (!reference) {
            throw new Error(`Course lemma ${newLemma.publicId} not found in global library registry.`);
        }

        // (2) Create the selected lemma object
        const newSelectedLemma: SelectedLemma = {
            lemmaStatus: "INCOMPLETE",
            lemmaManualOverride: false,
            hintContent: null,
            wasUsed: false,
            sufficient: "INSUFFICIENT",
            resolvedAt: null,
            dismissedAt: null,
            ref: {
                source: "course",
                publicId: newLemma.publicId,
            },
        };

        // (3) Add the selected lemma to the document state
        this.#state.question.selectedLemmas.push(newSelectedLemma);

    }

    public isSelectedLemmaComplete(selectedLemma: SelectedLemma): boolean {
        /**
         * Check if <selectedLemma> is complete.
         * If the <selectedLemma> is complete, return true.
         * Otherwise, return false.
         * 
         * === Precondition ===
         * <selectedLemma> must be a valid <SelectedLemma> object in the document state.
         */
        return selectedLemma.lemmaStatus === "COMPLETE";
    }

    public isSelectedLemmaOverridden(selectedLemma: SelectedLemma): boolean {
        /**
         * If <selectedLemma> is not complete but has been overriden, then return true.
         * Remember, completeness means either proven or manually overridden.
         */
        return selectedLemma.lemmaManualOverride;
    }

    public deleteSelectedLemma(selectedLemma: SelectedLemma): void {
        /**
         * Delete <selectedLemma> from the document state.
         * 
         * === Precondition ===
         * <selectedLemma> must exist in the document
         */
        this.#state.question.selectedLemmas = this.#state.question.selectedLemmas.filter(
            lemma => lemma.ref.publicId !== selectedLemma.ref.publicId,
        );
    }

    public checkLemmas(): boolean {
        /**
         * Check if all lemmas are complete. 
         * If atleast one lemma is incomplete, return false immediately.
         * Otherwise, return true.
         */
        const lemmas = this.#state.question.selectedLemmas;

        for (const lemma of lemmas){
            if (lemma.lemmaStatus !== "COMPLETE" && !lemma.lemmaManualOverride) return false;
        }
        return true;
    
    }

    // ==== Delta Management ====

    public applyDelta(delta: Delta): DeltaValidationCode | null {
        /**
         * Apply a delta to question or body content.
         * Returns a validation error code, or null on success.
         */
        
        // (1) Increment the delta counter and get the content
        let content;
        if (delta.target === "question") {
            this.deltas.question += 1;
            content = this.#state.question.content;

        } else {
            this.deltas.body += 1;
            content = this.#state.body.content;
        }

        // (2) Apply the delta
        let nextContent: string;
        if (delta.type === "insert") {
            nextContent = content.slice(0, delta.index) + delta.content + content.slice(delta.index);
        } else if (delta.type === "delete") {
            nextContent = content.slice(0, delta.startIndex) + content.slice(delta.endIndex);
        } else if (delta.type === "replace") {
            nextContent = content.slice(0, delta.startIndex) + delta.content + content.slice(delta.endIndex);
        } else {
            return "INVALID_DELTA_SHAPE";
        }

        if (delta.target === "question") {
            this.#state.question.content = nextContent;
            this.#state.question.revision = delta.revision;
        } else {
            this.#state.body.content = nextContent;
            this.#state.body.revision = delta.revision;
        }

        return null;
    }

    public hasPendingEdits(): boolean {
        /**
         * True when unsaved deltas are still in RAM (legacy buffer / questionBuffer length > 0).
         */
        return this.deltas.body > 0 || this.deltas.question > 0;
    }

    public clearPendingEditCounters(): void {
        /**
         * Reset pending-delta counters after a successful content flush.
         */
        this.deltas.body = 0;
        this.deltas.question = 0;
    }

    isCleanDelta(delta: Delta): DeltaValidationCode | null {
        /**
         * Check delta shape, revision ordering, and content bounds before apply.
         */
        // (1) Validate revision number
        const revisionError = this.#validateRevisionNumber(delta);
        if (revisionError) {
            return revisionError;
        }

        // (2) Validate delta shape
        const slice = this.#getContentSlice(delta.target);
        const deltaShapeError = this.#validateDeltaShape(delta, slice.content.length);
        if (deltaShapeError){
            return deltaShapeError;
        }

        return null;
    }

    #validateNextLength(
        contentLength: number,
        removedLength: number,
        insertedLength: number,
    ): DeltaValidationCode | null {
        /**
         * Given <contentLength>, <removedLength>, and <insertedLength>, check if the next length is within the bounds.
         */
        const nextLength = contentLength - removedLength + insertedLength;
        if (nextLength < 0 || nextLength > MAX_DOCUMENT_LENGTH) {
            return "DOCUMENT_SIZE_LIMIT";
        }
        return null;
    }
    #validateDeltaShape(delta: Delta, contentLength: number): DeltaValidationCode | null {
        /**
         * Given <delta>, check if the delta fields are correct before applying it to the hot document state.
         */

        switch (delta.type) {
            case "insert": {
                if (!Number.isSafeInteger(delta.index)) {
                    return "INVALID_DELTA_SHAPE";
                }
                if (delta.index < 0 || delta.index > contentLength) {
                    return "INDEX_OUT_OF_BOUNDS";
                }
                const contentError = this.#validateContentString(delta.content);
                if (contentError) {
                    return contentError;
                }
                return this.#validateNextLength(contentLength, 0, delta.content.length);
            }
            case "delete": {
                if (!Number.isSafeInteger(delta.startIndex) || !Number.isSafeInteger(delta.endIndex)) {
                    return "INVALID_DELTA_SHAPE";
                }
                if (delta.startIndex < 0 || delta.endIndex < 0) {
                    return "INVALID_INDEX";
                }
                if (delta.startIndex > delta.endIndex) {
                    return "INVALID_RANGE";
                }
                if (delta.startIndex > contentLength || delta.endIndex > contentLength) {
                    return "INDEX_OUT_OF_BOUNDS";
                }
                return this.#validateNextLength(contentLength, delta.endIndex - delta.startIndex, 0);
            }
            case "replace": {
                if (!Number.isSafeInteger(delta.startIndex) || !Number.isSafeInteger(delta.endIndex)) {
                    return "INVALID_DELTA_SHAPE";
                }
                if (delta.startIndex < 0 || delta.endIndex < 0) {
                    return "INVALID_INDEX";
                }
                if (delta.startIndex > delta.endIndex) {
                    return "INVALID_RANGE";
                }
                if (delta.startIndex > contentLength || delta.endIndex > contentLength) {
                    return "INDEX_OUT_OF_BOUNDS";
                }
                const contentError = this.#validateContentString(delta.content);
                if (contentError) {
                    return contentError;
                }
                return this.#validateNextLength(
                    contentLength,
                    delta.endIndex - delta.startIndex,
                    delta.content.length,
                );
            }
        }
    }

    #validateContentString(content: string): DeltaValidationCode | null {
        if (typeof content !== "string") {
            return "INVALID_CONTENT";
        }
        if (content.length > MAX_DELTA_CONTENT_LENGTH) {
            return "DELTA_TOO_LARGE";
        }
        return null;
    }


    #validateRevisionNumber(delta: Delta): DeltaValidationCode | null {
        /**
         * Given <delta>, Return the appropriate delta validation code if payload is incorrect. Otherwise, return null.
         */

        if (!Number.isSafeInteger(delta.revision)) {
            return "INVALID_DELTA_SHAPE";
        }
        if (delta.revision <= 0) {
            return "INVALID_REVISION";
        }
        // Revision is appropriate, check if it is the next revision
        const slice = this.#getContentSlice(delta.target);
        if (slice.revision + 1 !== delta.revision) {
            return "REVISION_MISMATCH";
        }
        // Revision is appropriate and is the next revision, return null
        return null;  
    }

    #getContentSlice(target: Target): { content: string; revision: number } {
        /**
         * Given <target>, return the content and revision of the target.
         */
        if (target === "question") {
            return {
                content: this.#state.question.content,
                revision: this.#state.question.revision,
            };
        }
        return {
            content: this.#state.body.content,
            revision: this.#state.body.revision,
        };
    }

    public checkQuestionDeltaThreshold(): boolean {
        /**
         * Return true if # of deltas (for question) has exceeded QUESTION_DELTA_THRESHOLD.
         * Return false otherwise.
         */
        return this.deltas.question >= QUESTION_DELTA_THRESHOLD;
    }

    public checkBodyDeltaThreshold(): boolean {
        /**
         * Return true if # of deltas (for body) has exceeded BODY_DELTA_THRESHOLD.
         * Return false otherwise.
         */
        return this.deltas.body >= BODY_DELTA_THRESHOLD;
    }

    

    // ==== Abort ML Pipeline Management ====

    // TODO: What is the lemma poll timer for? Why call it here? What does cancelMLTrigger do here? also, does the abort controller live in the document orchestrator or somewheere else?
    public abortAllMLTriggers(reason: string): void {
        /**
         * Cancel all in-flight ML work for this document.
         *
         * Parameters: none.
         *
         * How to use: Call at the start of abort paths (settings opened, question delta,
         * new state mutation) before starting a new run. Bumps `#analysisRunId` and emits
         * `document:analysis:status` with phase `"aborted"` so clients hide the status bar.
         *
         * Also: (1) cancelMLTrigger on Scheduler, (2) AbortController for Gemini (TODO).
         */
        this.#qAbortController?.abort(reason);
        this.#qAbortController = null;
        this.#bAbortController?.abort(reason);
        this.#bAbortController = null;

        this.stopMlQuestionTimer();
        this.stopMlBodyTimer();

        this.#analysisRunId += 1;
        this.broadcastAnalysisStatus("aborted");
    }

    // TODO implement this
    public abortMLQuestionTrigger(reason: string): void {
        /**
         * Cancel in-flight ML question trigger for this document.
         *
         * Parameters: none.
         *
         * How to use: Call at the start of abort paths (settings opened, question delta,
         * new state mutation) before starting a new run.
         */
        this.#qAbortController?.abort(reason);
        this.#qAbortController = null;
        this.#analysisRunId += 1;
        this.broadcastAnalysisStatus("aborted");
    }

    // TODO implement this
    public abortMLBodyTrigger(reason: string): void {
        /**
         * Cancel in-flight ML body trigger for this document.
         *
         * Parameters: none.
         *
         * How to use: Call at the start of abort paths (settings opened, question delta,
         * new state mutation) before starting a new run.
         */
        this.#bAbortController?.abort(reason);
        this.#bAbortController = null;
        this.#analysisRunId += 1;
        this.broadcastAnalysisStatus("aborted");
    }

    // ==== Settings Management ====
    public openSettings(): void {
        /**
         * Force the settings state to be "open," abort ML, and broadcast.
         */
        this.#state.settings.isOpen = true;
    }


    public closeSettings(): void {
        /**
         * Force the settings state to be "closed," start a new ML run, and broadcast.
         * Lock the proof text box TODO make the frontend do this.
         */
        this.#state.settings.isOpen = false;
    }

    // ==== Proof Text Box Management ====
    
    public lockProofTextBox(): void {
        /**
         * Lock the proof text box.
         * 
         */
    
        this.#state.settings.isOpen = false;
    }

    public unlockProofTextBox(): void {
        /**
         * Unlock the proof text box.
         */
        this.#state.settings.isOpen = true;
    }

    // ==== Proof Type Management ====
    public updateProofType(proofType: ProofType, proofTypeOrigin: ProofTypeOrigin): void {
        /**
         * Update the proof type of the document.
         */
        
        this.#state.proofType = proofType;
        this.#state.proofTypeOrigin = proofTypeOrigin;
    }
    public getProofType(): ProofType {
        /**
         * Return the proof type of the document.
         */
        return this.#state.proofType;
    }

    // ==== Math Statement Management ====
    public isMathStatementInDocumentState(mathStatement: MathStatement): boolean {
        /**
         * Given a <mathStatement>, return true if it exists in the current document state. Else, return false.
         */

        return this.#state.question.selectedMathStatements.some(selectedMathStatement => selectedMathStatement.ref.publicId === mathStatement.publicId);
    }

    public addMathStatement(mathStatement: MathStatement): void {
        /**
         * Add a <mathStatement> to the document state.
         * <mathStatement> can be a user-defined or a course math statement.
         */
        // (1) Check if the math statement is already in the document state
        if (this.isMathStatementInDocumentState(mathStatement)) {
            throw new Error(`Math statement ${mathStatement.type} already in document state.`);
        }

        // (2) Add the user defined math statement to the document state
        if (mathStatement.kind === "user-defined") {
            this.#addUserDefinedMathStatement(mathStatement);
        }

        // (3) Add the course math statement to the document state
        else {
            this.#addCourseMathStatement(mathStatement);
        }
    }

    #addUserDefinedMathStatement(mathStatement: UserDefinedMathStatement): void {
        /**
         * <mathStatement> is a user-defined math statement.
         * It has no concept of textbook, order index, or course.
         */
        const newSelectedMathStatement: SelectedMathStatement = {
            type: mathStatement.type,
            hintContent: null,
            wasUsed: false,
            sufficient: "INSUFFICIENT",
            resolvedAt: null,
            dismissedAt: null,
            ref: {
                source: "user-defined",
                publicId: mathStatement.publicId,
            },
        };

        this.#state.question.selectedMathStatements.push(newSelectedMathStatement);
    }
    #addCourseMathStatement(mathStatement: CourseMathStatement): void {
        /**
         * <mathStatement> is a course math statement.
         * It has a concept of textbook, order index, and course.
         */

         // (1) Pull the lemma from the global library registry. This is because lemma is stored in the global library already
         const reference = GlobalLibraryRegistry.getMathStatement(mathStatement.coursePublicId, mathStatement.publicId);
         if (!reference) {
             throw new Error(`Course math statement ${mathStatement.publicId} not found in global library registry.`);
         }

        // (2) Create the selected math statement object
        const newSelectedMathStatement: SelectedMathStatement = {
            type: mathStatement.type,
            hintContent: null,
            wasUsed: false,
            sufficient: "INSUFFICIENT",
            resolvedAt: null,
            dismissedAt: null,
            ref: {
                source: "course",
                publicId: mathStatement.publicId,
            },
        };

        // (3) Add the selected math statement to the document state
        this.#state.question.selectedMathStatements.push(newSelectedMathStatement);
    }

    public deleteSelectedMathStatement(selectedMathStatement: SelectedMathStatement): void {
        /**
         * Delete <selectedMathStatement> from the document state.
         * 
         * === Precondition ===
         * <selectedMathStatement> must exist in the document state
         */
        this.#state.question.selectedMathStatements = this.#state.question.selectedMathStatements.filter(
            mathStatement => mathStatement.ref.publicId !== selectedMathStatement.ref.publicId,
        );
    }
    public getSelectedMathStatement(mathStatementPublicId: string): SelectedMathStatement | undefined {
        /**
         * Given a <mathStatementPublicId>, return the corresponding selected math statement from the document state.
         * If not found, return undefined.
         */
        return this.#state.question.selectedMathStatements.find(mathStatement => mathStatement.ref.publicId === mathStatementPublicId);
    }

    // ==== ML Trigger Management ====

        // TODO implement this
    public onStateMutation(state: string): void{
        /**
         * This is for question only not for body.
         * <state> is the state that changed.
         * Whenever a state changes (not including user typing their proof in), check provability. Abort any previous triggers.
         * Call it when:
         * (1) When the user opens settings
         * (2) When the user closes settings
         */

        // Since proof depends on question. Need to check question first and then the body
        this.abortMLQuestionTrigger(`aborted:${state}:mutation`);
        

        if (this.#checkQuestionTriggerConditions(this.#state.question.content, this.#state.question.selectedLemmas)) {

            // Start a fresh ML run with cancellation + stale-run protection.
            void this.runQuestionAnalysis();
        }
    }

    public isSettingsOpen(): boolean {
        /**
         * Check if the settings are open.
         */
        return this.#state.settings.isOpen;
    }

    async runQuestionAnalysis(): Promise<void> {
        /**
         * Run the question analysis.
         * (5) Call the AI service
         * (6) Apply the analysis result to the document state
         * (7) Broadcast the document state
         * (8) Broadcast the analysis status as "idle"
         * (9) Clean up the abort controller if it is the current one
         */

        // (1) Cleanup previous controller, set up new, increment run id
        const runId = this.#setUpQuestionAnalysis();
        const controller = this.#qAbortController;
        if (!controller) return;

        // (2) Broadcast the analysis status as "analyzing." Needed for the UI to show the progress bar.
        this.broadcastAnalysisStatus("analyzing");

        // (3) Build the prompt
        const composed = buildQuestionPrompt(this.#state);

        try {
            // (4) Call Gemini generateContent (JSON).
            const payload = await this.#callGemini(runId, controller, composed);

            // (5) Stale response guard (newer run started while this request was in flight).
            if (runId !== this.#analysisRunId) return;

            // (6) Enforce the analysis policy
            const context = buildPromptContext({ state: this.#state });
            const normalized = enforceQuestionAnalysisPolicy(payload, composed.fieldPolicy, context);

            // (7) Apply the analysis result to the document state
            this.#applyQuestionAnalysisResult(normalized, composed.fieldPolicy);
            this.broadcastDocumentState();
            this.broadcastAnalysisStatus("idle");

        } catch (error) {
            // Expected path for explicit aborts.
            if (controller.signal.aborted) return;

            // If another run superseded this one, drop silently.
            if (runId !== this.#analysisRunId) return;

            console.error("Question analysis request failed:", error);
            this.broadcastAnalysisStatus("idle");
        } finally {
            
            // Clean up the abort controller if it is the current one
            if (this.#qAbortController === controller) {
                this.#qAbortController = null;
            }
        }
    }


    #setUpQuestionAnalysis(): number {
        /**
         * Set up a new question analysis run.
         * (1) Increment the analysis run id
         * (2) Abort any previous question analysis runs
         * (3) Create a new abort controller
         * (4) Return the new analysis run id
         */
        this.#analysisRunId += 1;
        this.#qAbortController?.abort("aborted:superseded");
        this.#qAbortController = new AbortController();
        return this.#analysisRunId;
    }

    async #callGemini(runId: number,controller: AbortController, composed: ComposedPrompt): Promise<QuestionAnalysisResponse> {
        /**
         * Question analysis via Gemini `generateContent` only.
         * `runId` is for server-side correlation; not included in model input.
         * RAG: plug in `setQuestionRetrievalProvider` under `ml/gemini/retrieval`.
         */
        return callGeminiQuestionAnalysis({
            runId,
            composed,
            abortSignal: controller.signal,
        });
    }

    #applyQuestionAnalysisResult(response: QuestionAnalysisResponse, fieldPolicy: ComposedPrompt["fieldPolicy"]): void {
        /**
         * Apply the question analysis result to the document state.
         * (1) Update the provability
         * (2) Update the proof type
         * (3) Update the suggested math statements
         */
        
        // (1) Update the provability
        this.#state.question.provability = response.provability;

        // (2) Update the proof type
        if (response.proofType != null) {
            this.#state.proofType = response.proofType;
            if (this.#state.proofTypeOrigin === ProofTypeOrigin.UNDETECTED) {
                this.#state.proofTypeOrigin = ProofTypeOrigin.DETECTED;
            }
        } 
        else if (fieldPolicy.proofType === "required") {
            // We're not writing anything here because we do not want to update proof type when the ML model says no.
        }

        // Prototype: suggested math statements are validated but not merged into state yet.
        void response.suggestedMathStatements;
    }


    
    #checkQuestionTriggerConditions(question: string, lemmas: SelectedLemma[]): boolean {
        /**
         * If: (1) The question is empty. (2) Atleast one lemma is incomplete, return false immediately 
         * Else, return true
         * Also check for manual overrides. If a lemma is not complete BUT is overriden, skip it and check the next lemma
         */
        if (question.length === 0) return false;
        for (const lemma of lemmas){
            if (lemma.lemmaStatus !== "COMPLETE" && !lemma.lemmaManualOverride) return false;
        }
        return true;
    }

    
 



    // ==== Grace Period Management ====

    public startGraceTimer(onExpire: () => void, durationMs = DISCONNECT_GRACE_MS): void {
        /**
         * Start the grace timer for delayed eviction (Registry `eviction: "grace"` only).
         * Native disconnect uses immediate RAM eviction like legacy — no grace window.
         */
        this.stopGraceTimer();
        this.#timers.grace = setTimeout(() => {
            this.#timers.grace = null;
            onExpire();
        }, durationMs);
    }

    public isGraceTimerActive(): boolean {
        /**
         * Check if the grace period timer is currently active. Used to determine if a reconnecting user is within the grace period.
         */
        return this.#timers.grace !== null;
    }

    public stopGraceTimer(): void {
        /** 
         * Stop the grace period timer when:
         * (1) The user rejoins within the grace period, so we cancel the pending eviction.
         */
        if (this.#timers.grace != null) {
            clearTimeout(this.#timers.grace);
            this.#timers.grace = null;
        }
    }

    // ==== Autosave Management ====

    public startAutosaveTimer(){
        /**
         * Start the autosave interval when:
         * (1) The user made recent edits to the document 
         */

    }
    public isAutosaveTimerActive(): boolean {
        /**
         * Check if the autosave timer is currently active. Used to determine if we should flush the document state to the database soon.
         */
        return this.#timers.autosave !== null;
    }

    public stopAutosaveTimer(): void {
        /**
         * Stop the autosave interval when: 
         * 
         */
        if (this.#timers.autosave != null) {
            clearInterval(this.#timers.autosave);
            this.#timers.autosave = null;
        }
    }
    // ==== Lemma Trigger Management ====

    public startLemmaTimer(){
        /**
         * When this timer ends, check if all selected lemmas are complete. 
         * If lemmas are complete, do nothing. Else, restart timer
         * 
         */

        // (1) Stop the current timer
        this.stopLemmaTimer();

        // (2) Start a new timer
        this.#timers.lemma = setTimeout(() => {
            this.#timers.lemma = null;
            this.checkLemmas();
        }, LEMMA_TIMER_DURATION_MS);
    }

    
    public isLemmaTimerActive(): boolean {
        /**
         * Check if the lemma trigger timer is currently active. Used to determine if a lemma generation task is pending.
         */
        return this.#timers.lemma !== null;
    }

    public canStopLemmaTimer(): boolean {
        /**
         * Check if the lemma timer can be stopped.
         * If all selected lemmas are complete, return true. Else, return false.
         */
        return this.#state.question.selectedLemmas.every(lemma => lemma.lemmaStatus === "COMPLETE");
    }

    public stopLemmaTimer(): void {
        /**
         * Cancel the pending lemma trigger when:
         * (1) The user types another character, so we reset the debounce window.
         */
        if (this.#timers.lemma != null) {
            clearTimeout(this.#timers.lemma);
            this.#timers.lemma = null;
        }
    }

    // ==== ML Trigger Management ====

    public startMlQuestionTimer(seconds: number){
        /**
         * Trigger ML question when:
         * (1) The user has not typed anything for the past `seconds` seconds
         */
    }
    public isMlQuestionTimerActive(): boolean {
        /**
         * Check if the ML question trigger timer is currently active. Used to determine if an ML question task is pending.
         */
        return this.#timers.mlQuestion !== null;
    }

    public stopMlQuestionTimer(): void {
        /**
         * Cancel the pending ML question trigger when:
         * (1) The user types another character, so we reset the debounce window.
         */
        if (this.#timers.mlQuestion != null) {
            clearTimeout(this.#timers.mlQuestion);
            this.#timers.mlQuestion = null;
        }
    }

    public startMlBodyTimer(seconds: number){
        /**
         * Trigger ML body when:
         * (1) The user has not typed anything for the past `seconds` seconds
         */
    }

    public isMlBodyTimerActive(): boolean {
        /**
         * Check if the ML body trigger timer is currently active. Used to determine if an ML body task is pending.
         */
        return this.#timers.mlBody !== null;
    }

    public stopMlBodyTimer(): void {
        /**
         * Cancel the pending ML body trigger when:
         * (1) The user types another character, so we reset the debounce window.
         */
        if (this.#timers.mlBody != null) {
            clearTimeout(this.#timers.mlBody);
            this.#timers.mlBody = null;
        }
    }

    // ==== Cleanup ====
    public purgeAllTimers(): void {
        /**
         * Purge all timers for a document when:
         * (1) The last socket disconnects (before a new grace timer is started).
         * (2) The workspace is evicted from RAM (explicit leave or post-grace flush).
         */
        this.stopGraceTimer();
        this.stopAutosaveTimer();
        this.stopMlQuestionTimer();
        this.stopMlBodyTimer();
        this.stopLemmaTimer();
    }


}