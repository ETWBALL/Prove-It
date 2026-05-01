// Type definitions here
export type DeltaType = 'insert' | 'delete' | 'replace'

export interface Delta {
    type: DeltaType
    startIndex: number
    endIndex: number
    content: string
    documentId: string
    validationLayer: 'LATEX_PARSER' | 'PROOF_GRAMMER' | 'COMPUTATION' | 'LOGIC_CHAIN'
    revision: number
}

export interface DocumentState {
    content: string,
    contentId: string,
    revision: number, // The current revision (or at the end of the buffer array). Helps for syncing server side document and the client side document
    buffer: Delta[],
    errorCount: number
}