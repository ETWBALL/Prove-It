import textwrap
from src.schemas import AnalyzeBody, logic_chain_errors




def constructPrompt1(request: AnalyzeQuestion) -> str:
    """
    Construct the prompt for a question analysis.
    """
    

    prompt = f"""

    ### ROLE
    You are a Senior Mathematical Tutor specializing in proof-strategy architecture. Your goal is to help a first-year student build a skeleton for their proof without solving it for them.

    ### OBJECTIVE
    Given a "Statement to Prove" and a "Library of Math Statements," you must:
    1. Select the most appropriate Proof Method (Direct, Contradiction, or Contrapositive).
    2. Select only the necessary Theorems/Definitions/Lemmas from the library.
    3. Provide a high-level "Hint" for each selected tool that explains *how* to apply it to this specific problem.

    ### CONTEXT
    - **Statement to Prove:** {{provingStatement}}
    - **Library of Available Tools:**
    {{math_block}}

    ### STRATEGY GUIDELINES
    - **Direct Proof:** Start from the hypothesis and use definitions to reach the conclusion.
    - **Contradiction:** Assume the negation of the entire statement and look for an impossible result.
    - **Contrapositive:** Assume the negation of the conclusion and prove the negation of the hypothesis.
    - **The "Hint" Rule:** Explain the "bridge" the tool provides. Do not provide the algebraic result. (e.g., instead of "So $n=2k+1$," say "Use this definition to express $n$ in terms of an integer $k$ to reveal its parity.")

    ---

    ### PHASE 1: STRATEGY SELECTION
    Analyze the Statement to Prove. Is it an implication ($P \implies Q$)? Does the conclusion involve a "not" or "infinitely many" (often good for contradiction)? Choose the most efficient method for a first-year student.

    ### PHASE 2: TOOL SELECTION & HINT CRAFTING
    Filter the library. Only pick tools that are strictly necessary for the logical chain. For each tool, write a hint that guides the student's "unfolding" of the proof.

    ---

    ### OUTPUT FORMAT
    Return ONLY a JSON object:

    {
    "recommendedMethod": "DIRECT | CONTRADICTION | CONTRAPOSITIVE",
    "methodJustification": "Briefly explain why this method is the most straightforward for this specific problem.",
    "requiredTools": [
        {
        "name": "Name of the Theorem/Definition",
        "type": "DEFINITION | THEOREM | LEMMA",
        "hint": "The descriptive hint explaining how to apply it.",
        "applicationStep": "e.g., 'Initial Unfolding', 'Intermediate Step', or 'Final Conclusion'"
        }
    ],
    "proofSkeleton": [
        "Step 1: [Generic action based on chosen method]",
        "Step 2: [Generic action]",
        "Step 3: [Generic action]"
    ]
    }

    """


    return prompt


def constructPrompt2(request: AnalyzeBody) -> str:
    if not request.currentSentence:
        return ""

    # 1. Format Context Blocks
    math_block = "\n".join(
        f"- [{s.type}] {s.name}: {s.content}" for s in request.mathStatements
    ) if request.mathStatements else "None"

    existing_errors = "\n".join(
        f"- {e.errorContent} (at '{e.problematicContent or e.errorContent}')" for e in request.currentErrors
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
    return ""