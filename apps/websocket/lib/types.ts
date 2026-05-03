import { Socket } from "socket.io"

// Type definitions here
export type DeltaType = 'insert' | 'delete' | 'replace'

export interface Suggestion{
    suggestionContent: string,
    startIndexSuggestion: number,
    endIndexSuggestion: number
}

export interface ErrorState {
    publicId: string,
    startIndexError: number,
    endIndexError: number,
    errorContent: string,
    suggestion: Suggestion | null
    resolvedAt: Date | null,
    dismissedAt: Date | null,
    problematicContent?: string, // Needed for ML trigger
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

export interface DocumentState {
    content: string,
    contentId: string,
    revision: number, // The current revision (or at the end of the buffer array). Helps for syncing server side document and the client side document
    buffer: Delta[],
    errors: ErrorState[],
}

export type AuthenticatedSocket = Socket & {
  data: {
    user?: { publicId: string; sessionPublicId: string }
  }
}