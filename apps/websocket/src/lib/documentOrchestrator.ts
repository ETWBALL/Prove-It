import { Scheduler } from "./Scheduler";
import {
    AnalysisPhase,
    AnalysisStatusPayload,
    Delta,
    DOCUMENT_ANALYSIS_STATUS_EVENT,
    DOCUMENT_STATE_UPDATED_EVENT,
    EmitToDocument,
    HotDocumentState,
} from "./types";

const QUESTION_DELTA_THRESHOLD = 50;
const BODY_DELTA_THRESHOLD = 30;
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
     */ 
    #state: HotDocumentState;
    timers: Scheduler = new Scheduler();
    #emit: EmitToDocument;
    #analysisRunId = 0;
    deltas: {question: number, body: number} = {question: 0, body: 0}; 



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
    public onStateMutation(): void{
        /**
         * Whenever a state changes (not including user typing their proof in), check provability. Abort any previous triggers
         */

        this.abortMLPipeline();
        
        // TODO come back to this and decide to have a ml trigger class
        if (this.#checkProvabilityConditions(this.#state.question.text, this.#state.question.currentLemmas)) {

            // Check provability 
            this.#mlTrigger.isProvable(800);
        }
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
    public abortMLPipeline(): void {
        /**
         * Cancel scheduled and in-flight ML work for this document.
         *
         * Parameters: none.
         *
         * How to use: Call at the start of abort paths (settings opened, question delta,
         * new state mutation) before starting a new run. Bumps `#analysisRunId` and emits
         * `document:analysis:status` with phase `"aborted"` so clients hide the status bar.
         *
         * Also: (1) cancelMLTrigger on Scheduler, (2) AbortController for Gemini (TODO).
         */
        this.#timers.cancelMlTrigger();
        this.#analysisRunId += 1;
        this.broadcastAnalysisStatus("aborted");
    }

    // ==== Settings Management ====
    public openSettings(): void {
        /**
         * Force the settings state to be "open," abort ML, and broadcast.
         */
        this.#state.settings.isOpen = true;
        this.abortMLPipeline();
        this.broadcastDocumentState();
    }

    
    // ==== ML Trigger Management ====

    // TODO implement this
    public isProvable(document: HotDocumentState): string | null {
        /** 
        * Depending on doc state, give the correct prompt to ML
        * Choose correct prompt. ML should return <true> if the question is provable and <false> if not.
        * Note if its provable, 
        */

        // (1) Select the correct prompt. Recieve {prompt: string, format: string} obj
        // (2) Send the ml result 
        // (3) Recieve the ml result and store it in the doc state
        // (4) Depending on the format, store it exactly into the doc state

        return null;
    }

        // TODO implement this
    #checkProvabilityConditions(question: string, lemmas: Lemma[]): boolean {
        /**
         * If: (1) The question is empty. (2) Atleast one lemma is incomplete, return false immediately 
         * Else, return true
         */
    
    }

    
    #selectPrompt(document: HotDocumentState): {prompt: string, expectedResponseFormat: string} {
        /**
         * Depending on doc state, give the correct prompt to ML
         * Prompts should change according to the following:
         * (1) Question is set. 
         * (2) Question AND ProofType is set
         * (3) Question AND MathStatents are set
         * (4) Question AND ProofType AND MathStatements are set
         */
        return {prompt: "", expectedResponseFormat: ""};
    }

    // TODO implement this
    // TODO small note: MAke sure to format the json file correclty to put it directly back into doc state easily
    #prompt1(question: string): string | null{
        /**
         * Prompt to check provability when only the question is set. 
         * Else, return null
         */
        return null;
    }

    #prompt2(question: string, proofType: string): string{
        /**
         * Prompt to check provability when the question and proof type are set. Ask for a binary classification of whether the question is provable or not, along with reasoning.
         * If the question is provable, return <true>. If not, return <false>.
         */
        return "";
    }


}