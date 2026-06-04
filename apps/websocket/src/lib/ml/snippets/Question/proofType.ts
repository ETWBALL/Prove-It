import { FieldPolicy, PromptContext, ProofTypeFieldPolicy } from "../../../types";



export function buildProofTypeSnippet(context: PromptContext, fieldPolicy: FieldPolicy): string {
    /**
     * PROMPT SNIPPET: Builds the proof type snippet. Changes according to policy rules.
     */
    const header = "PROOF TYPE RULES:";
    const policy = fieldPolicy.proofType;

    switch (policy) {
        case "required":
            return [
                header,
                "No proof type has been chosen yet.",
                "You must infer and return the most appropriate proof type in `proofType`.",
            ].join("\n");
        case "locked":
            return [
                header,
                `The user selected proof type: ${context.proofType}.`,
                "Evaluate provability using this proof type only.",
                "Do not change `proofType`; return the same value or null if you only report provability.",
            ].join("\n");
        case "optional_change":
            return [
                header,
                `The user selected proof type: ${context.proofType}.`,
                "Keep this proof type unless it is invalid for the statement.",
                "If invalid, you may return a better proof type in `proofType`.",
            ].join("\n");
    }
}

export function proofTypeJsonRule(policy: ProofTypeFieldPolicy, context: PromptContext): string {
    /**
     * PROMPT SNIPPET: Builds the JSON rule for the proof type field. Changes according to policy rules.
     */
    switch (policy) {
        case "required":
            return "`proofType` is required and must be a valid proof type enum value.";
        case "locked":
            return `\`proofType\` must equal "${context.proofType}" or be null. Do not propose a different proof type.`;
        case "optional_change":
            return `\`proofType\` may equal "${context.proofType}" or a revised valid proof type if the current one is unsuitable.`;
    }
}
