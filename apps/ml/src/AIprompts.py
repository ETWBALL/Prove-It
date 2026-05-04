from src.schemas import AnalyzeRequest, ErrorType


def get_prompt(request: AnalyzeRequest) -> str:

    content_block = (
        f"""
FULL PROOF (for context):
{request.content}

CURRENT SENTENCE (focus here):
{request.currentSentence}
""".strip()
        if request.context
        else f"""
SENTENCE TO ANALYZE:
{request.currentSentence}
""".strip()
    )

    math_block = "\n".join(
        f"- [{s.type}] {s.name}: {s.content}"
        for s in request.mathStatements
    ) if request.mathStatements else "None"

    existing_block = "\n".join(
        f"- {e.startIndexError}-{e.endIndexError}: {e.errorContent}"
        for e in request.currentErrors
    ) if request.currentErrors else "None"




    prompt = f"""
You are a mathematical proof grader specializing in PROOF GRAMMAR — the clarity, wording, and notation of mathematical proofs written by first-year university students.

Your job is to flag issues that would make a proof hard to understand for another first-year student.

---

STATEMENT BEING PROVED:
{request.provingStatement}

{content_block}

AVAILABLE MATH STATEMENTS STUDENTS HAVE ACCESS TO (theorems, definitions, lemmas):
{math_block}

ALREADY FLAGGED ERRORS (do NOT re-flag these):
{existing_block}

---

SEVERITY GUIDE:
- LOW: stylistic issues (e.g. informal language, minor phrasing)
- MODERATE: could confuse a reader (e.g. ambiguous pronoun, unexpanded acronym)
- CRITICAL: makes the proof hard or impossible to follow (e.g. undefined term, missing quantifier, missing justification)

VALID ERROR TYPES (use exactly as written):
{valid_error_types}
---

Return ONLY a valid JSON array. No explanation, no markdown, no backticks.

Each object must have:
- startIndexError: integer (character index in the full proof where the error starts)
- endIndexError: integer (character index where it ends)
- errorContent: string (brief description of the error)
- type: one of the valid error types above
- severity: LOW | MODERATE | CRITICAL
- layer: "PROOF_GRAMMER"
- suggestion: {{ suggestionContent: string, startIndexSuggestion: integer, endIndexSuggestion: integer }} or null

If no errors found, return an empty array: []
""".strip()

    return prompt
