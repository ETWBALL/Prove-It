import { buildPromptContext, getAllFieldPolicies } from "./promptContext";
import { baseRoleSnippet, questionSnippet } from "./snippets/Question/base";
import { buildMathStatementsSnippet } from "./snippets/Question/mathStatements";
import { jsonOutputSnippet } from "./snippets/Question/outputSchema";
import { buildProofTypeSnippet } from "./snippets/Question/proofType";
import { ProofTypeOrigin } from "@prove-it/db";
import { QUESTION_ANALYSIS_RESPONSE_FORMAT, ComposedPrompt, HotDocumentState} from "../types";


export function buildQuestionPrompt(state: HotDocumentState, proofTypeOrigin?: ProofTypeOrigin): ComposedPrompt {
    /**
     * Builds the full question-analysis prompt from document state and field policies.
     */

    // (1) Build the prompt context
    const context = buildPromptContext({state, proofTypeOrigin});

    // (2) Derive the field policy
    const fieldPolicy = getAllFieldPolicies(context);

    // (3) Build the proof type snippet
    const proofTypeSnippet = buildProofTypeSnippet(context, fieldPolicy);
    const mathStatementsSnippet = buildMathStatementsSnippet(context, fieldPolicy);

    const prompt = [
        baseRoleSnippet(),
        questionSnippet(context),
        proofTypeSnippet,
        mathStatementsSnippet,
        jsonOutputSnippet(context, fieldPolicy),
    ].join("\n\n");

    return {
        prompt,
        fieldPolicy,
        expectedResponseFormat: QUESTION_ANALYSIS_RESPONSE_FORMAT,
    };
}
