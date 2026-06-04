import { ProofTypeOrigin } from "@prove-it/db";
import { HotDocumentState } from "../types/Document";
import {
    FieldPolicy,
    MathStatementsFieldPolicy,
    PromptContext,
    ProofTypeFieldPolicy,
} from "../types/Prompt";

function resolveProofTypeOrigin(state: HotDocumentState, override?: ProofTypeOrigin): ProofTypeOrigin {
    /**
     * Proof type can be: undetected, detected, user-set. This function answers which one it is.
     */
    if (override) return override;
    return state.proofTypeOrigin;
}

function isProofTypeChosen(origin: ProofTypeOrigin): boolean {
    /**
     * Returns true if the proof type is chosen (detected or user-set).
     */
    return origin === ProofTypeOrigin.DETECTED || origin === ProofTypeOrigin.USER_SET;
}

export function buildPromptContext(input: {state: HotDocumentState, proofTypeOrigin?: ProofTypeOrigin}): PromptContext {
    /**
     * Returns what the prompt must include.
     */
    const { state, proofTypeOrigin: originOverride } = input;
    const proofTypeOrigin = resolveProofTypeOrigin(state, originOverride);

    return {
        question: state.question.content,
        proofType: state.proofType,
        proofTypeOrigin,
        proofTypeChosen: isProofTypeChosen(proofTypeOrigin),
        proofTypeStrictness: state.settings.strictnessProofType,
        mathStatementsPopulated: state.question.selectedMathStatements.length > 0,
        mathStatementStrictness: state.settings.strictnessMathStatements,
        selectedMathStatements: state.question.selectedMathStatements,
        coursePublicId: state.coursePublicId,
        userDefinedMathStatements: state.userDefinedMathStatements,
    };
}


export function getAllFieldPolicies(context: PromptContext): FieldPolicy {
    /**
     * Derives JSON field mutation rules from prompt context.
     * Empty fields must be filled; strictness only applies after user/course values exist.
     */
    const proofType = deriveProofTypeFieldPolicy(context);
    const suggestedMathStatements = deriveMathStatementsFieldPolicy(context);

    // Package everything and send it over
    return { proofType, suggestedMathStatements };
}

function deriveProofTypeFieldPolicy(context: PromptContext): ProofTypeFieldPolicy {
    /**
     * Derives the proof type field policy from the prompt context.
     */
    
    // (1) If the proof type is not chosen, it must be required
    if (!context.proofTypeChosen) {
        return "required";
    }

    // (2) If the proof type is strict, it must be locked
    if (context.proofTypeStrictness) {
        return "locked";
    }

    // (3) If the proof type is not strict, it must be optional
    return "optional_change";
}

function deriveMathStatementsFieldPolicy(context: PromptContext): MathStatementsFieldPolicy {
    /**
     * Returns the math statements field policy from the prompt context.
     */
    
    // (1) If the math statements are not populated, it must be required
    if (!context.mathStatementsPopulated) {
        return "required";
    }

    // (2) If the math statements are strict, it must be locked
    if (context.mathStatementStrictness) {
        return "locked_empty";
    }

    // (3) If the math statements are not strict, it must be optional
    return "optional_add";
}
