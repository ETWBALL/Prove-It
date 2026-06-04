import { PromptContext } from "../../../types";

export function baseRoleSnippet(): string {
    /**
     * PROMPT SNIPPET: The base role snippet. Who the AI is and what their task is.
     */
    return [
        "ROLE: You are a strict mathematical proof assistant.",
        "TASK: Analyze whether the proving statement can be proved given the provided constraints.",
        "Return only valid JSON matching the response schema described below.",
    ].join("\n");
}

export function questionSnippet(context: PromptContext): string {
    /**
     * PROMPT SNIPPET: The proving statement. The statement to be proven.
     */
    return [
        "PROVING STATEMENT:",
        context.question,
    ].join("\n");
}
