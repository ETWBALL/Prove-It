import { ComposedPrompt, QuestionAnalysisResponse } from "../../types";
import { buildQuestionAnalysisContents } from "./buildContents";
import { getGeminiClient, getGeminiQuestionModel } from "./client";
import { getQuestionRetrievalProvider } from "./retrieval";

export interface CallGeminiQuestionAnalysisInput {
    /** Server-side correlation only; not sent to the model. */
    runId: number;
    composed: ComposedPrompt;
    abortSignal: AbortSignal;
}


export async function callGeminiQuestionAnalysis(input: CallGeminiQuestionAnalysisInput): Promise<QuestionAnalysisResponse> {
    /**
     * Calls Gemini `models.generateContent` (JSON response) for question analysis.
     * Retrieval is pluggable; default is no RAG.
     */

    // (1) Destructure the input.
    const { runId, composed, abortSignal } = input;

    // (2) Retrieve the context for the question.
    const retrievedChunks = await getQuestionRetrievalProvider().retrieveForQuestion({
        composed,
        runId,
    });

    // (3) Build the contents string. For RAG do later TODO.
    const contents = buildQuestionAnalysisContents(composed, retrievedChunks);

    // (4) Call Gemini `models.generateContent`.
    const response = await getGeminiClient().models.generateContent({
        model: getGeminiQuestionModel(),
        contents,
        config: {
            responseMimeType: "application/json",
            abortSignal,
        },
    });

    const text = response.text?.trim();
    if (!text) {
        throw new Error("Gemini question analysis returned empty text");
    }

    return JSON.parse(text) as QuestionAnalysisResponse;
}
