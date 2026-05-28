import { Scheduler } from "./Scheduler";
import { Delta, HotDocumentState } from "./types";

const QUESTION_DELTA_THRESHOLD = 50;
const BODY_DELTA_THRESHOLD = 30;


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
     * - messenger: A function to send messages back to the client associated with this document.
     * - deltas: Keeps track of the number of deltas received for both question and body to determine when to persist to the database.
     */ 
    #state: HotDocumentState;
    #timers: Scheduler;
    #messenger: (eventName: string, documentId: string, payload: any) => void;
    #deltas: {question: number, body: number}; 



    // TODO implement this
    constructor(initialState: HotDocumentState, messenger: (eventName: string, documentId: string, payload: any) => void) {
        this.#state = initialState;
        this.#messenger = messenger;
        this.#timers = new Scheduler();
        this.#deltas = {question: 0, body: 0};
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
       // (1) Validate the delta. Check if the delta is well-formed, if the revision number is correct, and if the delta can be applied to the current state without conflicts.
       
       // (2) Apply the delta to the in-memory document state. This involves updating the question text or content based on the type of delta (insert, delete, replace) and its target.

    }

    #validateDelta(delta: Delta): boolean {
        /**
         * Check if the delta is well-formed, if the revision number is correct, and if the delta can be applied to the current state without conflicts.
         * Return true if valid, false otherwise.
         */
        return false;
    }

    public persistNeeded(): boolean {
        /**
         * Return true if # of deltas (for both question and content) has exceeded macros.
         */
        return false;
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