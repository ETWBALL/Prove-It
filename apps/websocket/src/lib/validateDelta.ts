import type { Delta } from "./types";

export const MAX_DELTA_CONTENT_LENGTH = 50_000;
export const MAX_DOCUMENT_LENGTH = 1_000_000;

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



function validateContentString(content: string): DeltaValidationCode | null {
    if (typeof content !== "string") {
        return "INVALID_CONTENT";
    }
    if (content.length > MAX_DELTA_CONTENT_LENGTH) {
        return "DELTA_TOO_LARGE";
    }
    return null;
}



/** Validates a {@link Delta} before applying it to document content. Returns an error code or null. */
export function validateDeltaForContent(delta: Delta, contentLength: number): DeltaValidationCode | null {
    const revisionError = validateRevision(delta.revision);
    if (revisionError) {
        return revisionError;
    }

    switch (delta.type) {
        case "insert": {
            if (!isSafeInteger(delta.index)) {
                return "INVALID_DELTA_SHAPE";
            }
            if (delta.index < 0 || delta.index > contentLength) {
                return "INDEX_OUT_OF_BOUNDS";
            }
            const contentError = validateContentString(delta.content);
            if (contentError) {
                return contentError;
            }
            return validateNextLength(contentLength, 0, delta.content.length);
        }
        case "delete": {
            if (!isSafeInteger(delta.startIndex) || !isSafeInteger(delta.endIndex)) {
                return "INVALID_DELTA_SHAPE";
            }
            if (delta.startIndex < 0 || delta.endIndex < 0) {
                return "INVALID_INDEX";
            }
            if (delta.startIndex > delta.endIndex) {
                return "INVALID_RANGE";
            }
            if (delta.startIndex > contentLength || delta.endIndex > contentLength) {
                return "INDEX_OUT_OF_BOUNDS";
            }
            return validateNextLength(contentLength, delta.endIndex - delta.startIndex, 0);
        }
        case "replace": {
            if (!isSafeInteger(delta.startIndex) || !isSafeInteger(delta.endIndex)) {
                return "INVALID_DELTA_SHAPE";
            }
            if (delta.startIndex < 0 || delta.endIndex < 0) {
                return "INVALID_INDEX";
            }
            if (delta.startIndex > delta.endIndex) {
                return "INVALID_RANGE";
            }
            if (delta.startIndex > contentLength || delta.endIndex > contentLength) {
                return "INDEX_OUT_OF_BOUNDS";
            }
            const contentError = validateContentString(delta.content);
            if (contentError) {
                return contentError;
            }
            return validateNextLength(
                contentLength,
                delta.endIndex - delta.startIndex,
                delta.content.length,
            );
        }
    }
}
