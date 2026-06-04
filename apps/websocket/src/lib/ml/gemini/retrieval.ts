import { ComposedPrompt } from "../../types";


// TODO all of this is for RAG. Later


/** One retrieved passage to inject ahead of the composed prompt when RAG is enabled. */
export interface RetrievedChunk {
    source: string;
    content: string;
}

export interface QuestionRetrievalInput {
    composed: ComposedPrompt;
    runId: number;
}

/**
 * Optional RAG hook for question analysis. Default provider returns no chunks.
 * Replace via `setQuestionRetrievalProvider` when file search / embeddings are ready.
 */
export interface QuestionRetrievalProvider {
    retrieveForQuestion(input: QuestionRetrievalInput): Promise<RetrievedChunk[]>;
}

const noopProvider: QuestionRetrievalProvider = {
    async retrieveForQuestion() {
        return [];
    },
};

let activeProvider: QuestionRetrievalProvider = noopProvider;

export function getQuestionRetrievalProvider(): QuestionRetrievalProvider {
    return activeProvider;
}

export function setQuestionRetrievalProvider(provider: QuestionRetrievalProvider): void {
    activeProvider = provider;
}
