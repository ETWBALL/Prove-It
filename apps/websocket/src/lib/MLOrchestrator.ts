export class MLOrchestrator {
    /**
     * === Responsibilities ===
     * Contains methods for different types of triggers sent to redis
     * 
     * === Private Attributes ===
     * #activeJobs: Track active job IDs for cancellation
     */

    #activeJobs: Map<string, string>; 

    constructor(){
        /**
         * Create a new ML Orchestrator instance with an empty set of active jobs. This will be used to track and manage ML trigger jobs for document sessions.
         */
        this.#activeJobs = new Map();
    }

    checkProvability

}