import { ProofTypeOrigin } from "@prove-it/db";
import { buildQuestionPrompt } from "./ml/composePrompt";
import { callGeminiQuestionAnalysis } from "./ml/gemini";
import { enforceQuestionAnalysisPolicy } from "./ml/enforceResponsePolicy";
import { buildPromptContext } from "./ml/promptContext";
import {
    AnalysisPhase,
    AnalysisStatusPayload,
    ComposedPrompt,
    Delta,
    DOCUMENT_ANALYSIS_STATUS_EVENT,
    DOCUMENT_STATE_UPDATED_EVENT,
    EmitToDocument,
    HotDocumentState,
    Lemma,
    QuestionAnalysisResponse,
    SelectedLemma,
} from "./types";

const QUESTION_DELTA_THRESHOLD = 50;
const BODY_DELTA_THRESHOLD = 30;
const DISCONNECT_GRACE_MS = 30_000;
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
        grace: NodeJS.Timeout | null, // One-shot countdown for disconnect grace period
        autosave: NodeJS.Timeout | null, // Interval for periodic autosave
        mlQuestion: NodeJS.Timeout | null, // Sliding window debounce for ML triggers (Question text)
        mlBody: NodeJS.Timeout | null, // Sliding window debounce for ML triggers (Body text)
        lemma: NodeJS.Timeout | null // Sliding window debounce for lemma generation triggers
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

    // TODO implement this
    public addLemma(lemma: Lemma): void {
        /**
         * Add lemma to document state. 
         */
    }

    // TODO implement this
    public addMathStatement(mathStatement: MathStatement): void {
        /**
         * This can either be user-defined or a course math statement.
         * Regardless, add the math statement to the document state.
         */
    }

    // TODO implement this
    public changeProofType(proofType: ProofType): void {
        /**
         * Update the proof type of the question. 
         */
    }


    // TODO implement this
    public checkLemmas(): boolean {
        /**
         * Check if all lemmas are complete. 
         * If atleast one lemma is incomplete, return false immediately.
         * Otherwise, return true.
         */
        return false;
    
    }

    // ==== Delta Management ====

    // TODO implement this
    public applyDelta(delta: Delta): void {
        /**
         * Apply the delta by first validating it, then storing it into the hot
         * doc state. Target is either 'question' or 'content'.
         * 
        */
       // (1) Validate the delta. Check if the delta is well-formed, if the revision number is correct, and if the delta can be applied to the current state without conflicts
       
       // (2) Apply the delta to the in-memory document state. This involves updating the question text or content based on the type of delta (insert, delete, replace) and its target.



    }

    #validateDelta(delta: Delta): boolean {
        /**
         * Check if the delta is well-formed, if the revision number is correct, and if the delta can be applied to the current state without conflicts.
         * Return true if valid, false otherwise.
         */
        return false;
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
        this.abortAllMLTriggers("aborted:settings:opened");
        this.#stopMlQuestionTimer();
        this.broadcastDocumentState();
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
            void this.#runQuestionAnalysis();
        }
    }

    async #runQuestionAnalysis(): Promise<void> {
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


    

        // TODO implement this
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

    public startGracePeriod(onExpire: () => void, durationMs = DISCONNECT_GRACE_MS): void {
        /**
         * Create a new grace period timer when:
         * (1) The user disconnects from a document session.
         */
        this.#stopGraceTimer();
        this.#timers.grace = setTimeout(() => {
            this.#timers.grace = null;
            onExpire();
        }, durationMs);
    }

    public stopGracePeriod(): void {
        /**
         * Stop the grace period timer when:
         * (1) The user rejoins within the grace period, so we cancel the pending eviction.
         */
        this.#stopGraceTimer();
    }

    #isGraceTimerActive(): boolean {
        /**
         * Check if the grace period timer is currently active. Used to determine if a reconnecting user is within the grace period.
         */
        return this.#timers.grace !== null;
    }

    #stopGraceTimer(): void {
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

    #startAutosaveTimer(){
        /**
         * Start the autosave interval when:
         * (1) The user made recent edits to the document 
         */

    }
    #isAutosaveTimerActive(): boolean {
        /**
         * Check if the autosave timer is currently active. Used to determine if we should flush the document state to the database soon.
         */
        return this.#timers.autosave !== null;
    }

    #stopAutosaveTimer(): void {
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

    #startLemmaTimer(){
        /**
         * Trigger Lemma generation when:
         * (1) The user has not typed anything for the past `seconds` seconds after making an edit that could impact lemmas.
         */
    }
    #isLemmaTimerActive(): boolean {
        /**
         * Check if the lemma trigger timer is currently active. Used to determine if a lemma generation task is pending.
         */
        return this.#timers.lemma !== null;
    }

    #stopLemmaTimer(): void {
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

    #startMlQuestionTimer(seconds: number){
        /**
         * Trigger ML question when:
         * (1) The user has not typed anything for the past `seconds` seconds
         */
    }
    #isMlQuestionTimerActive(): boolean {
        /**
         * Check if the ML question trigger timer is currently active. Used to determine if an ML question task is pending.
         */
        return this.#timers.mlQuestion !== null;
    }

    #stopMlQuestionTimer(): void {
        /**
         * Cancel the pending ML question trigger when:
         * (1) The user types another character, so we reset the debounce window.
         */
        if (this.#timers.mlQuestion != null) {
            clearTimeout(this.#timers.mlQuestion);
            this.#timers.mlQuestion = null;
        }
    }

    #startMlBodyTimer(seconds: number){
        /**
         * Trigger ML body when:
         * (1) The user has not typed anything for the past `seconds` seconds
         */
    }

    #isMlBodyTimerActive(): boolean {
        /**
         * Check if the ML body trigger timer is currently active. Used to determine if an ML body task is pending.
         */
        return this.#timers.mlBody !== null;
    }

    #stopMlBodyTimer(): void {
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
         * (1) The document session is evicted after the grace period expires, so we clean up all pending timers.
         */
        this.#stopGraceTimer();
        this.#stopAutosaveTimer();
        this.#stopMlQuestionTimer();
        this.#stopMlBodyTimer();
        this.#stopLemmaTimer();
    }


}