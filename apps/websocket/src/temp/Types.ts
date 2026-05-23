// =========================================================
// 1. PRISMA-ALIGNED ENUMS & PRIMITIVES
// =========================================================

export type ProofType = 
  | "DIRECT" | "CONTRADICTION" | "CONTRAPOSITIVE" | "WEAK_INDUCTION" 
  | "STRONG_INDUCTION" | "COUNTEREXAMPLE" | "STRUCTURAL_INDUCTION" 
  | "BICONDITIONAL" | "CONDITIONAL" | "CASE_ANALYSIS";

export type ProofStatus = "COMPLETE" | "INCOMPLETE" | "FAILED_COMPILATION";

export type ValidationLayer = "PROOF_GRAMMAR" | "LOGIC_CHAIN";

export type Library = 
  | "DEFINITION" | "THEOREM" | "PROPERTY" | "AXIOM" 
  | "COROLLARY" | "CONJECTURE" | "PROPOSITION";

export type ErrorType = 
  // Logical Errors
  | "INCORRECT_NEGATION" | "ASSUMING_THE_CONVERSE" | "EQUIVOCATION" 
  | "FALSE_DICHOTOMY_IN_CASE_ANALYSIS" | "UNJUSTIFIED_REVERSIBILITY" 
  | "MISAPPLYING_A_THEOREM" | "MISAPPLYING_A_DEFINITION" | "MISAPPLYING_A_LEMMA" 
  | "MISAPPLYING_A_PROPERTY" | "MISAPPLYING_AN_AXIOM" | "MISAPPLYING_A_COROLLARY" 
  | "MISAPPLYING_A_CONJECTURE" | "MISAPPLYING_A_PROPOSITION" | "AFFIRMING_THE_CONSEQUENT" 
  | "CIRCULAR_REASONING" | "JUMPING_TO_CONCLUSIONS" | "IMPROPER_GENERALIZATION" 
  | "IMPLICIT_ASSUMPTION" | "CONTRADICTS_PREVIOUS_STATEMENT" | "SCOPE_ERROR" 
  | "NON_SEQUITUR" | "VACUOUS_PROOF_FALLACY" | "EXISTENTIAL_INSTANTIATION_ERROR" 
  | "ASSUMING_THE_GOAL" | "VARIABLE_SHADOWING" | "PROOF_BY_EXAMPLE" 
  | "ILLEGAL_OPERATION" | "VACUOUS_NEGATION" | "STRUCTURE_ERROR"
  // Grammar Errors
  | "INFORMAL_LANGUAGE" | "AMBIGUOUS_PRONOUN" | "MISSING_PUNCTUATION" 
  | "INCOMPLETE_SENTENCE" | "MISSING_DEFINITION_UNFOLD" | "UNEXPANDED_ACRONYM" 
  | "INCONSISTENT_NOTATION" | "UNDEFINED_TERM_USED" | "MISSING_QUANTIFIER" 
  | "WRONG_LOGICAL_CONNECTIVE" | "REDUNDANT_STATEMENT" | "TYPE_MISMATCH" 
  | "DANGLING_VARIABLE" | "SYMBOL_AS_VERB" | "UNFOLDING_FAILURE";

export interface Delta {
  insert?: string | object;
  delete?: number;
  retain?: number;
  attributes?: Record<string, any>;
}

// =========================================================
// 2. MATH STATEMENTS & LEMMAS (Mirrors DB Junction Tables)
// =========================================================

export type MathStatementSource = "USER_DEFINED" | "COURSE" | "ML_CREATED";
export type MathSufficiency = "UNCHECKED" | "INSUFFICIENT" | "SUFFICIENT";

/** Represents the hot state of a `DocumentMathStatements` row */
export interface ActiveMathStatement {
  publicId: string;
  statementText: string;
  source: MathStatementSource;
  type: Library;
  sufficiency: MathSufficiency;
  hintContent: string | null;
  wasUsed: boolean;
}

/** Represents the hot state of a `DocumentLemma` row */
export interface ActiveLemma {
  publicId: string;
  name: string;
  statementText: string;
  status: ProofStatus;
  manualOverride: boolean;
}

// =========================================================
// 3. MACHINE LEARNING & COMPILER ERROR FEEDBACK
// =========================================================

export interface ErrorSuggestion {
  suggestionContent: string;
  startIndexSuggestion: number;
  endIndexSuggestion: number;
}

export interface ErrorState {
  publicId?: string;
  startIndexError: number;
  endIndexError: number;
  errorMessage: string;
  errortype: ErrorType;
  layer: ValidationLayer;
  suggestion: ErrorSuggestion | null;
  resolvedAt: Date | null;
  dismissedAt: Date | null;
}

// =========================================================
// 4. MODULARIZED SUB-STATES
// =========================================================

export type ProofOrigin = "UNDETECTED" | "DETECTED" | "USER_SET";
export type ProofValidity = "UNCHECKED" | "VALID" | "INVALID";
export type QuestionProvability = "UNCHECKED" | "PROVABLE" | "UNPROVABLE";

export interface ProofTypeState {
  strategy: ProofType | null;
  origin: ProofOrigin;
  validity: ProofValidity;
  invalidReason: string | null;
}

export interface ProofSettingsState {
  isOpen: boolean;
  globalAssumptions: string[];
  localAssumptions: string[];
}

export interface QuestionCanvasState {
  text: string;
  revision: number;
  buffer: Delta[];
  isComplete: boolean;
  timerActive: boolean;
  provability: QuestionProvability;
  statements: ActiveMathStatement[]; // Represents the Math Statement BOX
  lemmas: ActiveLemma[];             // Independent tracking for Lemmas
  lemmaTimerActive: boolean;
}

export interface ContentCanvasState {
  text: string;
  revision: number;
  buffer: Delta[];
  isLocked: boolean;
  errors: ErrorState[];
}

