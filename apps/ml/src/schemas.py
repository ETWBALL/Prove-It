from pydantic import BaseModel
from typing import Optional
from enum import Enum

# Mirror TypeScript enums from Prisma
class ErrorType(str, Enum):
    INCORRECTLY_NEGATING_A_STATEMENT = "INCORRECTLY_NEGATING_A_STATEMENT"
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

class Severity(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    CRITICAL = "CRITICAL"

class ValidationLayer(str, Enum):
    PROOF_GRAMMER = "PROOF_GRAMMER"
    LOGIC_CHAIN = "LOGIC_CHAIN"

# Mirror your TypeScript Suggestion interface
class Suggestion(BaseModel):
    suggestionContent: str
    startIndexSuggestion: int
    endIndexSuggestion: int

# Mirror your TypeScript ErrorState interface
class ErrorState(BaseModel):
    publicId: str
    startIndexError: int
    endIndexError: int
    errorContent: str
    suggestion: Optional[Suggestion] = None
    resolvedAt: Optional[str] = None
    dismissedAt: Optional[str] = None
    problematicContent: Optional[str] = None
    MLTriggered: Optional[bool] = None

class MathStatement(BaseModel):
    publicId: str
    type: str
    name: str
    content: str

# What the websocket sends to the ML service
class AnalyzeRequest(BaseModel):
    provingStatement: str # The statement being proven.
    documentId: str
    layer: ValidationLayer
    currentContent: str
    currentErrors: list[ErrorState]  # existing errors so ML doesn't re-flag them
    mathStatements: list[MathStatement]


# What the ML service sends back
class DetectedError(BaseModel):
    startIndexError: int
    endIndexError: int
    errorContent: str
    type: ErrorType
    severity: Severity
    layer: ValidationLayer
    suggestion: Optional[Suggestion] = None

# The full response back to websocket
class AnalyzeResponse(BaseModel):
    documentId: str
    errors: list[DetectedError]
