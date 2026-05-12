import textwrap

from src.database import courseMathStatements
from src.schemas import (
    AnalyzeBody,
    AnalyzeQuestion,
    AnalyzeSentence,
    logic_chain_errors,
    proof_grammar_errors,
    ProofType,
)


def _master_definitions_catalog() -> str:
    """Flatten preloaded course definitions for the prompt (dedupe by publicId)."""
    if not courseMathStatements:
        return "(definitions cache empty)"
    seen: set[str] = set()
    labels: list[str] = []
    for defs in courseMathStatements.values():
        for m in defs:
            if m.publicId in seen:
                continue
            seen.add(m.publicId)
            labels.append(f"{m.name} ({m.type})")
    return ", ".join(labels) if labels else "(no definitions loaded)"


def constructPrompt1(request: AnalyzeQuestion) -> str:
    """
    Construct the prompt for a question analysis.
    """
    currentMathStatments = ", ".join(
        f"{math.name} ({math.type})" for math in request.currentMathStatements
    )
    currentProofStrategies = (
        request.currentProofType.value
        if request.currentProofType is not None
        else "not specified"
    )
    allMathStatements = _master_definitions_catalog()
    allProofStrategies = ", ".join(member.value for member in ProofType)

    prompt = f"""

    ### ROLE
    You are a Mathematical Proof Auditor. Your goal is to optimize a student's "Proof Toolkit" by comparing their current document state against a master textbook library.

    ### INPUT DATA
    1. [MASTER_LIBRARY]: {allMathStatements} (The only allowed sources)
    2. [USER_DOCUMENT]: {currentMathStatments} (What the student already has)
    3. [CURRENT_STRATEGY]: {currentProofStrategies} (e.g., Direct, Contradiction)
    4. [PROOF_OPTIONS]: {allProofStrategies} (Alternative strategies)
    5. [GOAL]: {request.content}

    ### CRITICAL RULES
    - CLOSED SYSTEM: Never suggest definitions/theorems not found in [MASTER_LIBRARY].
    - MINIMALISM: Do not recommend extra statements if the current set is sufficient.
    - LOGICAL SYNERGY: If a [USER_DOCUMENT] item is irrelevant to the [GOAL] or the chosen [CURRENT_STRATEGY], mark it for removal.
    - DIRECTIONAL HINTS: Hints must be specific to the [GOAL]. Do not define the term; tell the student *how* to use it in this specific proof.

    ### TASK
    1. Determine if the [CURRENT_STRATEGY] is the most efficient. If not, suggest a better one from [PROOF_OPTIONS].
    2. Identify missing statements from [MASTER_LIBRARY] required for the proof.
    3. Identify redundant or irrelevant statements in [USER_DOCUMENT] that should be removed.
    4. For every recommended statement, provide a targeted "application_hint".

    ### OUTPUT FORMAT
    Return ONLY a valid JSON object.

    {{
        "recommended_proof_type": "string",
        "is_strategy_change": boolean,
        "add_math_statements": [
            {{
                "title": "string",
                "application_hint": "Example: 'Use this to rewrite the definition of n before squaring.'"
            }}
        ],
        "remove_math_statements": [
            {{
                "title": "string",
                "reason": "Example: 'This definition of Prime numbers is not used in a proof about Parity.'"
            }}
        ],
        "status_summary": "string (Short explanation: e.g., 'Sufficient', 'Missing Prerequisites', or 'Redundant Content')"
    }}

    """

    return prompt


def constructPrompt2(request: AnalyzeBody) -> str:
    if not request.currentSentence:
        return ""

    # 1. Format Context Blocks
    math_block = (
        "\n".join(f"- [{s.type}] {s.name}: {s.content}" for s in request.mathStatements)
        if request.mathStatements
        else "None"
    )

    existing_errors = (
        "\n".join(
            f"- {e.errorContent} (at '{e.problematicContent or e.errorContent}')"
            for e in request.currentSentenceErrors
        )
        if request.currentSentenceErrors
        else "None"
    )

    # 2. Build the Prompt
    prompt = f"""
    ### ROLE
    You are a formal mathematical proof validator for a strict first-year Discrete Math course.

    ### OBJECTIVE
    Analyze the "CURRENT SENTENCE" for logical fallacies. You must be pedantic.

    ---
    STATEMENT TO PROVE:
    {request.provingStatement}

    FULL PROOF CONTEXT:
    {request.content}

    CURRENT SENTENCE:
    {request.currentSentence}

    AVAILABLE THEOREMS/DEFINITIONS:
    {math_block}

    ALREADY FLAGGED ERRORS (Do not re-flag these):
    {existing_errors}

    VALID LOGIC ERROR TYPES (CODE FROM TAXONOMY FOR ERROR TYPE):
    {logic_chain_errors}

    ---
    ### EVALUATION PROTOCOL:
    1. Mechanical Justification: Every claim must follow from definitions or Prior Steps.
    2. Variable Integrity: Check for VARIABLE_SHADOWING (e.g., reusing 'k' for different integers).
    3. Implicit Assumptions: Flag ILLEGAL_OPERATION for unstated properties (e.g., division by zero).
    4. Structure: Check for STRUCTURE_ERROR if the proof method isn't declared at the start.

    ### PHASE 1: ANALYSIS & PHASE 2: CRITIQUE
    - Trace the logic from prior steps.
    - SKEPTICAL CRITIQUE: Ask "Am I being too lenient?" or "Did I miss a subtle jump in logic?"

    ---
    RETURN ONLY A JSON ARRAY. No markdown, no backticks.
    Format:
    [
      {{
        "errorSnippet": "the exact string of text that is wrong",
        "errorMessage": "brief description",
        "internalReasoning": "Your step-by-step logic",
        "suggestedFix": {{
            "suggestionContent": "correct phrasing",
            "suggestionSnippet": "what text should be replaced"
        }}
      }}
    ]
    If no errors, return [].
    """

    return textwrap.dedent(prompt).strip()


def constructPrompt3(request: AnalyzeSentence) -> str:
    """
    Construct the prompt for a sentence analysis.
    """

    currentMathStatments = ", ".join(
        f"{math.name} ({math.type})" for math in request.mathStatements
    )
    existing_errors = (
        "\n".join(
            f"- {e.errorContent} (at '{e.problematicContent or e.errorContent}')"
            for e in request.currentSentenceErrors
        )
        if request.currentSentenceErrors
        else "None"
    )

    prompt = f"""

    ### ROLE
    You are a formal mathematical proof writing validator for a strict first-year Discrete Math course.

    ### OBJECTIVE
    Analyze the "CURRENT SENTENCE" for proof writing and grammar errors only.
    You are NOT checking logical correctness — only how the sentence is written.

    ---
    STATEMENT TO PROVE:
    {request.provingStatement}

    FULL PROOF CONTEXT:
    {request.content}

    CURRENT SENTENCE:
    {request.sentence}

    AVAILABLE THEOREMS/DEFINITIONS:
    {currentMathStatments}

    ALREADY FLAGGED ERRORS (Do not re-flag these):
    {existing_errors}

    VALID GRAMMAR ERROR TYPES (USE ONLY THESE CODES):
    {proof_grammar_errors}

    ---
    ### EVALUATION PROTOCOL:
    1. Formality Check: Flag INFORMAL_LANGUAGE for casual phrasing, hedging words, or proof by intimidation.
    2. Clarity Check: Flag AMBIGUOUS_PRONOUN if any pronoun lacks a clear referent.
    3. Structure Check: Flag INCOMPLETE_SENTENCE if the sentence cannot stand as a complete mathematical thought.
    4. Notation Check: Flag INCONSISTENT_NOTATION, DANGLING_VARIABLE, or SYMBOL_AS_VERB where applicable.
    5. Definition Check: Flag MISSING_DEFINITION_UNFOLD or UNFOLDING_FAILURE if a term is used without being properly expanded.
    6. Quantifier Check: Flag MISSING_QUANTIFIER if a variable is used without specifying scope.

    ### PHASE 1: ANALYSIS & PHASE 2: CRITIQUE
    - Read the sentence in isolation, then in the context of the full proof.
    - SKEPTICAL CRITIQUE: Ask "Is this sentence precise enough for a formal proof?" and "Did I miss any subtle writing issue?"

    ---
    RETURN ONLY A JSON ARRAY. No markdown, no backticks.
    Format:
    [
      {{
        "errorSnippet": "the exact string of text that is wrong",
        "errorMessage": "brief description",
        "internalReasoning": "Your step-by-step logic",
        "suggestedFix": {{
            "suggestionContent": "correct phrasing",
            "suggestionSnippet": "what text should be replaced"
        }}
      }}
    ]
    If no errors, return [].

    """
    return prompt
