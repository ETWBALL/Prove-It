import { MLOrchestrator } from "./MLOrchestrator";
import { Scheduler } from "./Scheduler";
import { HotDocumentState } from "./types";


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
     */ 
    #state: HotDocumentState;
    #timers: Scheduler;
    #messenger: (eventName: string, documentId: number, payload: any) => void;
    #mlTrigger: MLOrchestrator;


    // TODO implement this
    constructor(initialState: HotDocumentState, messenger: (eventName: string, documentId: number, payload: any) => void) {
        this.#state = initialState;
        this.#messenger = messenger;
        this.#timers = new Scheduler();
        this.#mlTrigger = new MLOrchestrator();
    }

    // TODO implement this
    public onStateMutation(): void{
        /**
         * Whenever a state changes (not including user typing their proof in), check provability. Abort any previous triggers
         */

        this.abortMLPipeline();
        
        // TODO come back to this and decide to have a ml trigger class
        if (this.isProvable()){
            this.#schduleMLTrigger(800);
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
    public isProvable(): boolean {
        /**
         * Check if the question is provable. If: (1) The question is empty. (2) Atleast one lemma is incomplete, return false immediately 
         * Otherwise, return ML's result (true or false) by packaging (question, math statements, proof type) and sending to ML service. 
         */
        return false;
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


}