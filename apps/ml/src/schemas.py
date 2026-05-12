from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from enum import Enum

# Mirror TypeScript enums from Prisma

LOGIC_CHAIN_ERRORS = {
    "INCORRECT_NEGATION": "The negation of a statement is formed incorrectly, e.g. negating 'for all x, P(x)' as 'for all x, not P(x)' instead of 'there exists x such that not P(x)'.",
    "ASSUMING_THE_CONVERSE": "The proof uses 'if P then Q' when only 'if Q then P' was established. The implication is applied in the wrong direction.",
    "EQUIVOCATION": "A term is used with two different meanings within the same argument, making the reasoning invalid.",
    "FALSE_DICHOTOMY_IN_CASE_ANALYSIS": "A case split is presented as exhaustive but missing cases exist, e.g. only handling positive and negative cases but forgetting zero.",
    "UNJUSTIFIED_REVERSIBILITY": "A step treats a non-invertible operation as reversible without justification, e.g. concluding a = b from a² = b² without considering signs.",
    "MISAPPLYING_A_THEOREM": "A theorem is cited but its hypotheses are not satisfied, or its conclusion is applied beyond its scope.",
    "MISAPPLYING_A_DEFINITION": "A definition is invoked incorrectly, either with wrong conditions or applied to an object that doesn't meet the definition's requirements.",
    "MISAPPLYING_A_LEMMA": "A lemma is used in a context where its preconditions do not hold.",
    "MISAPPLYING_A_PROPERTY": "A property (e.g. commutativity, distributivity) is applied to an operation or set where it does not hold.",
    "MISAPPLYING_AN_AXIOM": "An axiom is applied outside its valid domain or used to justify something it does not support.",
    "MISAPPLYING_A_COROLLARY": "A corollary is cited but the parent theorem's conditions were not established in this proof.",
    "MISAPPLYING_A_CONJECTURE": "An unproven conjecture is used as if it were an established fact to justify a step.",
    "MISAPPLYING_A_PROPOSITION": "A proposition is applied incorrectly, either in the wrong direction or under conditions it does not cover.",
    "AFFIRMING_THE_CONSEQUENT": "The proof concludes P from 'if P then Q' and Q. This is a formal logical fallacy.",
    "CIRCULAR_REASONING": "The statement being proved is assumed (directly or indirectly) somewhere in the proof.",
    "JUMPING_TO_CONCLUSIONS": "A claim is made that does not follow from the immediately preceding statements without intermediate steps.",
    "IMPROPER_GENERALIZATION": "A result proven for a specific case or example is stated as if it holds universally.",
    "IMPLICIT_ASSUMPTION": "The proof relies on a fact that was never stated or established earlier in the argument.",
    "CONTRADICTS_PREVIOUS_STATEMENT": "This sentence directly contradicts something already established earlier in the proof.",
    "SCOPE_ERROR": "A variable or object is referenced outside the scope in which it was introduced or quantified.",
    "NON_SEQUITUR": "The statement does not follow at all.",
    "VACUOUS_PROOF_FALLACY": "When a user proves something for an empty set and assumes it applies to non-empty sets",
    "EXISTENTIAL_INSTANTIATION_ERROR": "Using a specific constant c to represent an arbitrary element before c is properly \"fixed\" in the proof",
    "ASSUMING_THE_GOAL": "A subtle version of circular reasoning where the user uses the conclusion to prove a step within the proof",
    "VARIABLE_SHADOWING": "Using the same variable $k$ for two different integers in the same proof (e.g., $a=2k$ and $b=2k$ implies $a=b$, which is false)" ,
    "PROOF_BY_EXAMPLE": "Attempting to prove a universal statement ($\forall x$) by showing it works for $x=1$ and $x=2$",
    "ILLEGAL_OPERATION": "(New). Dividing by a variable without first proving it is non-zero",
    "VACUOUS_NEGATION": "Incorrectly assuming that if the hypothesis is false, the implication is false",
    "STRUCTURE_ERROR": "Missing 'Proof:' header, 'QED' square, or not specifiying what kind of proof this is, i.e., direct, contradiction, contrapositive etc." ,

}

PROOF_GRAMMAR_ERRORS = {
    "INFORMAL_LANGUAGE": "Casual or imprecise language is used where formal mathematical language is expected, e.g. 'obviously', 'clearly', 'it's easy to see'. Using Proof by Intimidation (e.g., using \"It is trivial that...\") to hide a gap in the proof.",
    "AMBIGUOUS_PRONOUN": "A pronoun like 'it', 'this', or 'that' is used without a clear referent, making the sentence ambiguous.",
    "MISSING_PUNCTUATION": "A mathematical sentence is missing punctuation (period, comma) that is needed for clarity.",
    "INCOMPLETE_SENTENCE": "The sentence does not form a complete mathematical thought and cannot stand on its own.",
    "MISSING_DEFINITION_UNFOLD": "A term is used that should be expanded using its definition before proceeding, but the unfolding step is skipped.",
    "UNEXPANDED_ACRONYM": "An acronym or shorthand (e.g. 'WLOG', 'WTS', 'iff') is used without being defined or written out first.",
    "INCONSISTENT_NOTATION": "Different symbols or names are used to refer to the same object within the proof, causing confusion.",
    "UNDEFINED_TERM_USED": "A term appears in the proof that has not been defined or introduced anywhere in the document.",
    "MISSING_QUANTIFIER": "A statement about a variable is made without specifying whether it holds for all values or just some, e.g. missing ∀ or ∃.",
    "WRONG_LOGICAL_CONNECTIVE": "An incorrect logical connective is used, e.g. 'and' instead of 'or', or 'if' instead of 'if and only if'.",
    "REDUNDANT_STATEMENT": "A statement is made that was already proven or stated earlier in the proof and adds no new information.",
    "TYPE_MISMATCH": "A type error occurs when an operation is applied to objects of incompatible types, e.g. adding a number to a string, adding a set to a number, comparing a vector to a scalar",
    "DANGLING_VARIABLE": "A variable is used without being properly defined or introduced in the proof, similar to undefined term but specifically for math symbols",
    "SYMBOL_AS_VERB": "Using logical symbols like $\implies$ or $\therefore$ as a replacement for English verbs in a sentence (e.g., \"Then $x \implies 2x$\").",
    "UNFOLDING_FAILURE": "Failure to use the specific definition (e.g., using 'even' without stating $n=2k$).",
}


class ValidationLayer(str, Enum):
    PROOF_GRAMMER = "PROOF_GRAMMER"
    LOGIC_CHAIN = "LOGIC_CHAIN"


# Mirror Prisma `ErrorType` (packages/db/schema.prisma) for ML outputs.
class ErrorType(str, Enum):
    INCORRECT_NEGATION = "INCORRECT_NEGATION"
    ASSUMING_THE_CONVERSE = "ASSUMING_THE_CONVERSE"
    EQUIVOCATION = "EQUIVOCATION"
    FALSE_DICHOTOMY_IN_CASE_ANALYSIS = "FALSE_DICHOTOMY_IN_CASE_ANALYSIS"
    UNJUSTIFIED_REVERSIBILITY = "UNJUSTIFIED_REVERSIBILITY"
    MISAPPLYING_A_THEOREM = "MISAPPLYING_A_THEOREM"
    MISAPPLYING_A_DEFINITION = "MISAPPLYING_A_DEFINITION"
    MISAPPLYING_A_LEMMA = "MISAPPLYING_A_LEMMA"
    MISAPPLYING_A_PROPERTY = "MISAPPLYING_A_PROPERTY"
    MISAPPLYING_AN_AXIOM = "MISAPPLYING_AN_AXIOM"
    MISAPPLYING_A_COROLLARY = "MISAPPLYING_A_COROLLARY"
    MISAPPLYING_A_CONJECTURE = "MISAPPLYING_A_CONJECTURE"
    MISAPPLYING_A_PROPOSITION = "MISAPPLYING_A_PROPOSITION"
    AFFIRMING_THE_CONSEQUENT = "AFFIRMING_THE_CONSEQUENT"
    CIRCULAR_REASONING = "CIRCULAR_REASONING"
    JUMPING_TO_CONCLUSIONS = "JUMPING_TO_CONCLUSIONS"
    IMPROPER_GENERALIZATION = "IMPROPER_GENERALIZATION"
    IMPLICIT_ASSUMPTION = "IMPLICIT_ASSUMPTION"
    CONTRADICTS_PREVIOUS_STATEMENT = "CONTRADICTS_PREVIOUS_STATEMENT"
    SCOPE_ERROR = "SCOPE_ERROR"
    NON_SEQUITUR = "NON_SEQUITUR"
    VACUOUS_PROOF_FALLACY = "VACUOUS_PROOF_FALLACY"
    EXISTENTIAL_INSTANTIATION_ERROR = "EXISTENTIAL_INSTANTIATION_ERROR"
    ASSUMING_THE_GOAL = "ASSUMING_THE_GOAL"
    VARIABLE_SHADOWING = "VARIABLE_SHADOWING"
    PROOF_BY_EXAMPLE = "PROOF_BY_EXAMPLE"
    ILLEGAL_OPERATION = "ILLEGAL_OPERATION"
    VACUOUS_NEGATION = "VACUOUS_NEGATION"
    STRUCTURE_ERROR = "STRUCTURE_ERROR"

    INFORMAL_LANGUAGE = "INFORMAL_LANGUAGE"
    AMBIGUOUS_PRONOUN = "AMBIGUOUS_PRONOUN"
    MISSING_PUNCTUATION = "MISSING_PUNCTUATION"
    INCOMPLETE_SENTENCE = "INCOMPLETE_SENTENCE"
    MISSING_DEFINITION_UNFOLD = "MISSING_DEFINITION_UNFOLD"
    UNEXPANDED_ACRONYM = "UNEXPANDED_ACRONYM"
    INCONSISTENT_NOTATION = "INCONSISTENT_NOTATION"
    UNDEFINED_TERM_USED = "UNDEFINED_TERM_USED"
    MISSING_QUANTIFIER = "MISSING_QUANTIFIER"
    WRONG_LOGICAL_CONNECTIVE = "WRONG_LOGICAL_CONNECTIVE"
    REDUNDANT_STATEMENT = "REDUNDANT_STATEMENT"
    TYPE_MISMATCH = "TYPE_MISMATCH"
    DANGLING_VARIABLE = "DANGLING_VARIABLE"
    SYMBOL_AS_VERB = "SYMBOL_AS_VERB"
    UNFOLDING_FAILURE = "UNFOLDING_FAILURE"


# Mirror your TypeScript Suggestion interface
class Suggestion(BaseModel):
    suggestionContent: str
    startIndexSuggestion: int = 0
    endIndexSuggestion: int = 0

# Mirror your TypeScript ErrorState interface
class ErrorState(BaseModel):
    publicId: str = ""
    startIndexError: int = 0
    endIndexError: int = 0
    errorContent: str = ""
    suggestion: Optional[Suggestion] = None
    resolvedAt: Optional[str] = None
    dismissedAt: Optional[str] = None
    problematicContent: Optional[str] = None
    MLTriggered: Optional[bool] = None

class MathStatement(BaseModel):
    publicId: str = ""
    type: str
    name: str
    content: str


class ProofType(str, Enum):
    DIRECT = "DIRECT"
    CONTRADICTION = "CONTRADICTION"
    CONTRAPOSITIVE = "CONTRAPOSITIVE"
    WEAK_INDUCTION = "WEAK_INDUCTION"
    STRONG_INDUCTION = "STRONG_INDUCTION"
    COUNTEREXAMPLE = "COUNTEREXAMPLE"
    STRUCTURAL_INDUCTION = "STRUCTURAL_INDUCTION"
    BICONDITIONAL = "BICONDITIONAL"
    CONDITIONAL = "CONDITIONAL"
    CASE_ANALYSIS = "CASE_ANALYSIS"


class TaskType(str, Enum):
    QUESTION_ANALYSIS = "question_analysis"
    SENTENCE_ANALYSIS = "sentence_analysis"
    BODY_ANALYSIS = "body_analysis"


# Websocket can sends this schema at all times:
class Request(BaseModel):
    taskType: TaskType
    documentId: str
    payload: Any


# (1) Websocket sends a question analysis request
class AnalyzeQuestion(BaseModel):
    currentMathStatements: list[MathStatement] 
    content: str # The statement being proven.
    currentProofType: Optional[ProofType]


# (2) Websocket sends a single sentence analysis request
class AnalyzeSentence(BaseModel):
    mathStatements: list[MathStatement] # all math statements in the document
    provingStatement: str # The statement being proven.

    content: str # The content of the document. Won't be used in prompt, mainly needed for finding error indices
    sentence: str 

    currentSentenceErrors: list[ErrorState]  # existing errors so ML doesn't re-flag them

# (3) Websocket sends a body analysis request
class AnalyzeBody(BaseModel):
    mathStatements: list[MathStatement] # all math statements in the document
    provingStatement: str # The statement being proven.

    content: str # The content of the document
    currentSentence: str

    currentSentenceErrors: list[ErrorState]  # existing errors so ML doesn't re-flag them
    allDocumentErrors: list[ErrorState] # all errors in the document



# What the ML service sends back

# (1) ML sends back the needed definitions and theorems to prove the statement
class Response1(BaseModel):
    documentId: str
    proofType: ProofType
    mathStatements: list[MathStatement]


# (2) ML sends back the detected errors
class DetectedError(BaseModel):

    # Location of the error in the document
    startIndexError: int
    endIndexError: int
    problematicContent: str

    # Message to the user
    errorMessage: str
    errortype: ErrorType
    suggestedFix: Optional[Suggestion] = None

# The full response back to websocket
class Response2(BaseModel):
    documentId: str
    errors: list[DetectedError]


logic_chain_errors = "\n".join(
    f"- {k}: {v}" for k, v in LOGIC_CHAIN_ERRORS.items()
)

proof_grammar_errors = "\n".join(
    f"- {k}: {v}" for k, v in PROOF_GRAMMAR_ERRORS.items()
)