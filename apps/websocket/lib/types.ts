import { ErrorType } from "@prove-it/db/generated/prisma"
import { Socket } from "socket.io"

// Type definitions here
export type DeltaType = 'insert' | 'delete' | 'replace'

export interface Suggestion{
    suggestionContent: string,
    startIndexSuggestion: number,
    endIndexSuggestion: number
}

export interface ErrorState {
    // ``publicId`` is the Prisma row id once persisted. It is ``undefined`` for errors that ML just
    // produced and the websocket has not flushed to the DB yet — ``updateDatabase`` (in lib/helpers.ts)
    // creates the row, captures the generated id, and writes it back into the in-memory state.
    publicId: string | undefined,

    // Anchored against the full proof body, NOT the token-efficient prefix the ML service sees.
    startIndexError: number,
    endIndexError: number,

    // Maps to ``Error.errorMessage`` (DB column ``errorContent`` via @map) — short, user-facing description.
    errorMessage: string,
    errortype: ErrorType,

    // ``undefined`` (not null) when there is no suggested fix; mirrors how DB ``null`` is coerced on read.
    suggestion: Suggestion | undefined,

    resolvedAt: Date | null,
    dismissedAt: Date | null,

    // Exact substring of the proof body that got flagged. Captured at detection time so we can keep
    // showing it after the user edits — and so we can re-find the original span if the model re-flags it.
    problematicContent?: string,

    // True when an in-flight edit overlapped this error enough to invalidate it (see ``applyDeltatoErrors``).
    // The error is marked ``resolvedAt = now()`` (treated as stale) and surfaced to the ML pipeline so the
    // updated sentence gets re-evaluated. The client uses this flag to dim / hide the suggestion bubble
    // while we wait for fresh ML output.
    MLTriggered?: boolean,
}


export interface Delta {
    type: DeltaType
    startIndex: number
    endIndex: number
    content: string
    documentId: string
    revision: number
}


export type MathStatementType = 'DEFINITION' | 'THEOREM' | 'LEMMA' | 'PROPERTY' | 'AXIOM' | 'COROLLARY' | 'CONJECTURE' | 'PROPOSITION'


export interface MathStatements {
    publicId: string, 
    type: MathStatementType,
    name: string,
    content: string,
    /** ML / UI usage hint; mirrors Prisma ``MathStatement.hint`` */
    hint: string,
    textbook: string,
    orderIndex: number,
}

export type ProofType = 'DIRECT' | 'CONTRADICTION' | 'CONTRAPOSITIVE' | 'WEAK_INDUCTION' | 'STRONG_INDUCTION' | 'COUNTEREXAMPLE' | 'STRUCTURAL_INDUCTION' | 'BICONDITIONAL' | 'CONDITIONAL' | 'CASE_ANALYSIS'


export interface DocumentState {
    questionContent: string,
    questionRevision: number,
    questionBuffer: Delta[],
    content: string,
    contentId: string,
    revision: number, // The current revision (or at the end of the buffer array). Helps for syncing server side document and the client side document
    buffer: Delta[],
    errors: ErrorState[],
    coursePublicId: string | null,
    proofType: ProofType | null
    selectedMathStatements: MathStatements[] | null
}


export type AuthenticatedSocket = Socket & {
  data: {
    user?: { publicId: string; sessionPublicId: string }
  }
}


export interface Timers{
    databaseTimeout?: NodeJS.Timeout,
    mlTimeout?: NodeJS.Timeout,
    questionTimeout?: NodeJS.Timeout,
}



