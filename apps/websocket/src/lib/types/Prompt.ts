import { ProofType, ProofTypeOrigin } from "@prove-it/db";
import { QuestionAnalysisResponseFormat } from "./AIResponse";
import { SelectedMathStatement, UserDefinedMathStatement } from "./MathStatements";

/** How the model may populate `proofType` in the JSON response. */
export type ProofTypeFieldPolicy = "required" | "locked" | "optional_change";

/** How the model may populate `suggestedMathStatements` in the JSON response. */
export type MathStatementsFieldPolicy = "required" | "locked_empty" | "optional_add";

export interface FieldPolicy {
    proofType: ProofTypeFieldPolicy;
    suggestedMathStatements: MathStatementsFieldPolicy;
}

/**
 * One composable prompt segment.
 * - `instruction`: natural-language task guidance for the model.
 * - `fieldPolicy`: which JSON fields this segment governs (merged into final policy).
 */

/** Normalized document facts used to pick prompt snippets and JSON field rules. Used to build the prompt.*/
export interface PromptContext {
    question: string;
    proofType: ProofType;
    proofTypeOrigin: ProofTypeOrigin;
    proofTypeChosen: boolean;
    proofTypeStrictness: boolean;
    mathStatementsPopulated: boolean;
    mathStatementStrictness: boolean;
    selectedMathStatements: SelectedMathStatement[];
    coursePublicId: string | null;
    userDefinedMathStatements: Record<string, UserDefinedMathStatement>;
}

/** Final prompt text plus policies and schema id sent to the ML service. */
export interface ComposedPrompt {
    prompt: string;
    fieldPolicy: FieldPolicy;
    expectedResponseFormat: QuestionAnalysisResponseFormat;
}

