import { Library } from "@prove-it/db";
import { resolveMathStatement } from "../../../resolveMathStatement";
import {
    FieldPolicy,
    PromptContext,
} from "../../../types";


export function buildMathStatementsSnippet(context: PromptContext, fieldPolicy: FieldPolicy): string {
    /**
     * PROMPT SNIPPET: Builds the math statements snippet. Changes according to policy rules.
     */
    const policy = fieldPolicy.suggestedMathStatements;
    const header = "MATH STATEMENT RULES:";

    switch (policy) {
        case "required":
            return [
                header,
                "No math statements are selected yet.",
                context.coursePublicId
                    ? "Select required statements from the course library and return them in `suggestedMathStatements` (each with `name`, `reason`, and `hintContent`)."
                    : "Return required statements in `suggestedMathStatements` (each with `name`, `reason`, and `hintContent`).",
                "For each suggestion, `hintContent` must explain how to apply that statement in this proof—not restate the definition.",
            ].join("\n");


        case "locked_empty": {
            const selectedSummary = formatSelectedMathStatements(context);
            return [
                header,
                "Use only the selected math statements below.",
                "Pay special attention to any user-defined statements.",
                selectedSummary,
                "Do not add more statements: `suggestedMathStatements` must be an empty array [].",
            ].join("\n\n");
        }


        case "optional_add": {
            const selectedSummary = formatSelectedMathStatements(context);
            return [
                header,
                "Use the selected math statements below as your base pool.",
                "Pay special attention to any user-defined statements.",
                selectedSummary,
                "You may add additional statements in `suggestedMathStatements` if needed for provability.",
                "For each new suggestion, include `hintContent` describing how to apply the statement in this proof.",
            ].join("\n\n");
        }
    }
}

function formatSelectedMathStatements(context: PromptContext): string {
    /**
     * Formats the selected math statements into a prompt-readable block.
     *
     * @example
     * // no selections
     * "SELECTED MATH STATEMENTS: (none)"
     *
     * @example
     * `SELECTED MATH STATEMENTS:
     * - Definition of addition on ℕ (course, definition)
     * - My custom bound (user-defined, theorem)`
     */
    if (context.selectedMathStatements.length === 0) {
        return "SELECTED MATH STATEMENTS: (none)";
    }

    const lines = context.selectedMathStatements.flatMap((statement) => {
        const resolved = resolveMathStatement(
            statement.ref,
            context.coursePublicId,
            context.userDefinedMathStatements,
        );
        if (!resolved) return [];
        const { information } = resolved;

        const source = statement.ref.source === "user" ? "user-defined" : "course";
        const kind = formatLibraryKind(information.type);
        return [`- ${information.name} (${source}, ${kind})`];
    });

    return ["SELECTED MATH STATEMENTS:", ...lines].join("\n");
}

function formatLibraryKind(type: Library): string {
    /**
     * Formats the library kind into a prompt-readable string.
     */
    return type.toLowerCase();
}

export function mathStatementsJsonRule(fieldPolicy: FieldPolicy): string {
    /**
     * PROMPT SNIPPET: Builds the JSON rule for the math statements field. Changes according to policy rules.
     */
    const policy = fieldPolicy.suggestedMathStatements;
    switch (policy) {
        case "required":
            return "`suggestedMathStatements` is required; each entry must include `name`, `reason`, and `hintContent`.";
        case "locked_empty":
            return "`suggestedMathStatements` must be an empty array [].";
        case "optional_add":
            return "`suggestedMathStatements` may be [] or list additional statements; each entry must include `name`, `reason`, and `hintContent`.";
    }
}
