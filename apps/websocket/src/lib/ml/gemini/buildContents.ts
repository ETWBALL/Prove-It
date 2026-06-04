import { ComposedPrompt } from "../../types";
import { RetrievedChunk } from "./retrieval";

// TODO for RAG. Later
export function buildQuestionAnalysisContents(composed: ComposedPrompt, retrievedChunks: RetrievedChunk[]): string {
    /**
     * Builds the `contents` string passed to Gemini `generateContent`.
     * Prepends retrieved context when RAG chunks are present.
     */

    // (1) If no RAG chunks are present, return the composed prompt.
    if (retrievedChunks.length === 0) {
        return composed.prompt;
    }

    const retrievedSection = retrievedChunks
        .map((chunk, index) => `[${index + 1}] (${chunk.source})\n${chunk.content}`)
        .join("\n\n");

    return [
        "RETRIEVED CONTEXT (use only when relevant to the question):",
        retrievedSection,
        "---",
        composed.prompt,
    ].join("\n\n");
}
