import textwrap
from src.schemas import AnalyzeRequest, logic_chain_errors

def constructPrompt(request: AnalyzeRequest) -> str:
    if not request.currentSentence:
        return ""

    # 1. Format Context Blocks
    math_block = "\n".join(
        f"- [{s.type}] {s.name}: {s.content}" for s in request.mathStatements
    ) if request.mathStatements else "None"

    existing_errors = "\n".join(
        f"- {e.errorContent} (at '{e.errorSnippet}')" for e in request.currentErrors
    ) if request.currentErrors else "None"

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
        "errorType": "CODE_FROM_TAXONOMY",
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
