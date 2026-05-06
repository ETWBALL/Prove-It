from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


LOGIC_CHAIN_ERRORS = {
    "INCORRECT_NEGATION": "The negation of a statement is formed incorrectly.",
    "ASSUMING_THE_CONVERSE": "An implication is applied in the wrong direction.",
    "MISAPPLYING_A_THEOREM": "A theorem is cited without satisfying its hypotheses.",
    "JUMPING_TO_CONCLUSIONS": "A claim does not follow from prior statements.",
    "ILLEGAL_OPERATION": "An invalid operation is used (e.g. division by zero).",
    "STRUCTURE_ERROR": "Proof structure is incomplete or malformed.",
}


logic_chain_errors = "\n".join(f"- {k}: {v}" for k, v in LOGIC_CHAIN_ERRORS.items())


class ErrorType(str, Enum):
    LOGIC = "LOGIC"
    GRAMMAR = "GRAMMAR"
    FORMAT = "FORMAT"
    OTHER = "OTHER"


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ValidationLayer(str, Enum):
    LOGIC_CHAIN = "LOGIC_CHAIN"
    PROOF_GRAMMAR = "PROOF_GRAMMAR"


class Suggestion(BaseModel):
    suggestionContent: str
    startIndexSuggestion: int = 0
    endIndexSuggestion: int = 0


class ErrorState(BaseModel):
    publicId: str = ""
    startIndexError: int = 0
    endIndexError: int = 0
    errorContent: str = ""
    suggestion: Optional[Suggestion] = None


class MathStatement(BaseModel):
    type: str
    name: str
    content: str


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    documentId: str
    content: str
    layer: ValidationLayer = ValidationLayer.LOGIC_CHAIN
    provingStatement: str = ""
    currentSentence: str = ""
    # Accept websocket payload key `errors` and richer key `currentErrors`.
    currentErrors: list[ErrorState] = Field(default_factory=list, alias="errors")
    allErrors: list[ErrorState] = Field(default_factory=list)
    mathStatements: list[MathStatement] = Field(default_factory=list)


class DetectedError(BaseModel):
    startIndexError: int
    endIndexError: int
    problematicContent: str
    errorMessage: str
    errorType: ErrorType = ErrorType.OTHER
    severity: Severity = Severity.MEDIUM
    layer: ValidationLayer = ValidationLayer.LOGIC_CHAIN
    suggestion: Optional[Suggestion] = None


class AnalyzeResponse(BaseModel):
    documentId: str
    errors: list[DetectedError]
