/**
 * Controls which tables `flushStateToDatabase` writes in a single transaction.
 * Only enabled sections run; disabled sections leave DB rows unchanged.
 */
export interface FlushScope {
    documentMetadata: boolean;
    documentBody: boolean;
    errors: boolean;
    mathStatementLinks: boolean;
    lemmaLinks: boolean;
    proofAttempt: boolean;
}

/** Named scopes — use these at call sites instead of ad-hoc boolean objects. */
export const FlushScopes = {
    /** Proof + question text and document fields (typical delta / autosave). */
    content: {
        documentMetadata: true,
        documentBody: true,
        errors: false,
        mathStatementLinks: false,
        lemmaLinks: false,
        proofAttempt: false,
    },
    /** Body errors only (e.g. after ML grammar pass). */
    errorsOnly: {
        documentMetadata: false,
        documentBody: false,
        errors: true,
        mathStatementLinks: false,
        lemmaLinks: false,
        proofAttempt: false,
    },
    /** Selected math statement junction rows. */
    mathStatementsOnly: {
        documentMetadata: false,
        documentBody: false,
        errors: false,
        mathStatementLinks: true,
        lemmaLinks: false,
        proofAttempt: false,
    },
    /** Selected lemma junction rows. */
    lemmasOnly: {
        documentMetadata: false,
        documentBody: false,
        errors: false,
        mathStatementLinks: false,
        lemmaLinks: true,
        proofAttempt: false,
    },
    /** Append a proof attempt snapshot (explicit save — not every autosave). */
    proofAttemptOnly: {
        documentMetadata: false,
        documentBody: false,
        errors: false,
        mathStatementLinks: false,
        lemmaLinks: false,
        proofAttempt: true,
    },
    /** Full persist — use sparingly (e.g. grace eviction). */
    full: {
        documentMetadata: true,
        documentBody: true,
        errors: true,
        mathStatementLinks: true,
        lemmaLinks: true,
        proofAttempt: false,
    },
} as const satisfies Record<string, FlushScope>;
