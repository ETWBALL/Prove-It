import { QuestionAnalysisResponse } from "../types/AIResponse";
import { FieldPolicy, PromptContext } from "../types/Prompt";


export function enforceQuestionAnalysisPolicy(response: QuestionAnalysisResponse, fieldPolicy: FieldPolicy, context: PromptContext): QuestionAnalysisResponse {
    /**
     * Server-side enforcement of field policies.
     * The model may violate prompt rules; this normalizes the response before state mutation.
     */
    
    let proofType = response.proofType;
    let suggestedMathStatements = response.suggestedMathStatements;

    switch (fieldPolicy.proofType) {
        case "required":
            break;
        case "locked":
            proofType = context.proofType;
            break;
        case "optional_change":
            break;
    }

    switch (fieldPolicy.suggestedMathStatements) {
        case "required":
            break;
        case "locked_empty":
            suggestedMathStatements = [];
            break;
        case "optional_add":
            break;
    }

    return {
        ...response,
        proofType,
        suggestedMathStatements,
    };
}
