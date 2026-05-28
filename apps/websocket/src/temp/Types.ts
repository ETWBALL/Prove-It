// =========================================================
// 1. PRISMA-ALIGNED ENUMS & PRIMITIVES
// =========================================================

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

