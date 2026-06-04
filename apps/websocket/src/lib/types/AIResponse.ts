import { Library, ProofType, Provability } from "@prove-it/db";

/** Stable contract id sent to the ML service; not interpreted by the model. */
export const QUESTION_ANALYSIS_RESPONSE_FORMAT = "question_analysis_v1" as const;

export type QuestionAnalysisResponseFormat = typeof QUESTION_ANALYSIS_RESPONSE_FORMAT;


/**
 * ML response for question / provability analysis.
 * `runId` is owned by the websocket server only — never included here.
 */

export interface SuggestedMathStatementResponse {
    /** Course catalog name; server resolves full statement from the library registry. */
    name: string;
    /** Why this statement is needed for the question or proof approach. */
    reason: string;
    /** Actionable hint for how to introduce and use this statement in the proof. */
    hintContent: string;
}

export interface QuestionAnalysisResponse {
    provability: Provability;
    reasoning: string;
    proofType: ProofType | null;
    suggestedMathStatements: SuggestedMathStatementResponse[];
}

