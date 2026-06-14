// ====  Deltas ====
// Base properties every single delta must have

export type Target = 'question' | 'content';
interface BaseDelta {
    target: Target;
    id: string;               // UUID for idempotency (prevents double-processing)
    documentId: string;
    revision: number;         // For strict ordering
    timestamp: number;        // Epoch time for auditing/latency tracking
}
export interface InsertDelta extends BaseDelta {
    type: 'insert';
    index: number;            // Inserts only need one index
    content: string;
}
export interface DeleteDelta extends BaseDelta {
    type: 'delete';
    startIndex: number;
    endIndex: number;
}
export interface ReplaceDelta extends BaseDelta {
    type: 'replace';
    startIndex: number;
    endIndex: number;
    content: string;
}
export type Delta = InsertDelta | DeleteDelta | ReplaceDelta;

export type DeltaValidationCode =
    | "INVALID_DELTA_SHAPE"
    | "INVALID_REVISION"
    | "INVALID_INDEX"
    | "INVALID_RANGE"
    | "INDEX_OUT_OF_BOUNDS"
    | "INVALID_CONTENT"
    | "DELTA_TOO_LARGE"
    | "DOCUMENT_SIZE_LIMIT"
    | "REVISION_MISMATCH";
