import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
    /**
     * Returns the Gemini client.
     */
    if (!client) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not set");
        }
        client = new GoogleGenAI({ apiKey });
    }
    return client;
}

export function getGeminiQuestionModel(): string {
    /**
     * Returns the Gemini question model.
     */
    return process.env.GEMINI_QUESTION_MODEL ?? "gemini-2.5-pro";
}
