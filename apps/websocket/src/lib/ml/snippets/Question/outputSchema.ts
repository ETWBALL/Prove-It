import { Provability, ProofType } from "@prove-it/db";
import { FieldPolicy, PromptContext } from "../../types";
import { mathStatementsJsonRule } from "./mathStatements";
import { proofTypeJsonRule } from "./proofType";

function prismaEnumUnion(enumObject: Record<string, string>): string {
    /**
     * Converts a Prisma enum object to a string union.
     */
    return Object.values(enumObject)
        .map((value) => `"${value}"`)
        .join(" | ");
}

export function jsonOutputSnippet(context: PromptContext, fieldPolicy: FieldPolicy): string {
    /**
     * PROMPT SNIPPET: Builds the JSON output schema. Changes according to field policy rules.
     */
    return [
        "RESPONSE JSON SCHEMA (always include every key):",
        "{",
        `  "provability": ${prismaEnumUnion(Provability)},`,
        '  "reasoning": string,',
        `  "proofType": ${prismaEnumUnion(ProofType)} | null,`,
        '  "suggestedMathStatements": [{ "name": string, "reason": string, "hintContent": string }]',
        "}",
        "",
        "FIELD RULES:",
        `- provability: required.`,
        `- reasoning: required.`,
        `- ${proofTypeJsonRule(fieldPolicy.proofType, context)}`,
        `- ${mathStatementsJsonRule(fieldPolicy)}`,
        `- Each suggestedMathStatements entry: \`name\` (library catalog name), \`reason\` (why it is needed), \`hintContent\` (how to apply it in this proof—where to invoke it, what to substitute or assume, and how it advances the argument).`,
    ].join("\n");
}
