import { Document, prisma, Prisma } from "@prove-it/db";
import { ErrorState, FlushScope, HotDocumentState } from "./types";

/**
 * All Prisma / database access for document workspaces lives here.
 * Callers pass HotDocumentState in; helpers do not read from Registry or DocumentOrchestrator.
 */

export interface FlushResult {
    /** When `scope.errors` is true, errors include DB `publicId`s for newly created rows. */
    persistedErrors?: ErrorState[];
}

type TransactionClient = Prisma.TransactionClient;

export async function queryDocument(documentPublicId: string): Promise<Document> {
    /**
     * Query a document from the database. Return a Document object.
     *
     * - `documentPublicId`: Public id of the document to load.
     */
    const document = await prisma.document.findFirst({
        where: {
            publicId: documentPublicId,
            deletedAt: null,
        },
        include: {
            documentBody: true,
            proofAttempts: true,
            errors: true,
            documentMathStatements: true,
            usedLemmas: true,
            provingLemma: true,
        },
    });

    if (!document) {
        throw new Error(`Document not found: ${documentPublicId}`);
    }

    return document;
}

export async function flushStateToDatabase(
    documentPublicId: string,
    state: HotDocumentState,
    scope: FlushScope,
): Promise<FlushResult> {
    /**
     * Persist parts of HotDocumentState in one transaction, gated by `scope`.
     *
     * - `documentPublicId`: Public id of the document row to update.
     * - `state`: Current RAM snapshot (only fields for enabled scope sections are read).
     * - `scope`: Use `FlushScopes.content`, `FlushScopes.errorsOnly`, etc. — do not hand-roll booleans at call sites.
     *
     * Returns `persistedErrors` when `scope.errors` is true so the orchestrator can merge new `publicId`s.
     *
     * Not a WebSocket broadcast — use DocumentOrchestrator.broadcastDocumentState() for clients.
     */
    return prisma.$transaction(async (tx) => {
        const privateDocumentId = await resolvePrivateDocumentId(tx, documentPublicId);
        const result: FlushResult = {};

        if (scope.documentMetadata) {
            await writeDocumentMetadata(tx, documentPublicId, state);
        }

        if (scope.documentBody) {
            await writeDocumentBody(tx, privateDocumentId, state);
        }

        if (scope.errors) {
            result.persistedErrors = await writeErrors(tx, privateDocumentId, state.body.errors);
        }

        if (scope.mathStatementLinks) {
            await syncMathStatementLinks(tx, privateDocumentId, state);
        }

        if (scope.lemmaLinks) {
            await syncLemmaLinks(tx, privateDocumentId, state);
        }

        if (scope.proofAttempt) {
            await writeProofAttempt(tx, privateDocumentId, state);
        }

        return result;
    });
}

// ==== Transaction helpers (one concern per function; not exported) ====

async function resolvePrivateDocumentId(tx: TransactionClient, documentPublicId: string): Promise<number> {
    /**
     * Resolve the private document id from the public document id.
     */
    const row = await tx.document.findFirst({
        where: { publicId: documentPublicId, deletedAt: null },
        select: { privateId: true },
    });
    if (!row) {
        throw new Error(`Document not found: ${documentPublicId}`);
    }
    return row.privateId;
}

async function writeDocumentMetadata(tx: TransactionClient, documentPublicId: string, state: HotDocumentState): Promise<void> {
    /**
     * Write the document metadata to the database.
     */
    await tx.document.update({
        where: { publicId: documentPublicId },
        data: {
            title: state.title,
            status: state.status,
            provability: state.provability,
            proofType: state.proofType,
            lastEdited: new Date(),
        },
    });
}

async function writeDocumentBody(tx: TransactionClient, privateDocumentId: number, state: HotDocumentState ): Promise<void> {
    /**
     * Write the document body to the database.
     */
    await tx.documentBody.upsert({
        where: { privateDocumentId },
        update: {
            content: state.body.content,
            provingStatement: state.question.content,
        },
        create: {
            privateDocumentId,
            content: state.body.content,
            provingStatement: state.question.content,
        },
    });
}

async function writeErrors(tx: TransactionClient, privateDocumentId: number, errors: ErrorState[]): Promise<ErrorState[]> {
    /**
     * Write the errors to the database.
     */
    return Promise.all(
        errors.map(async (error): Promise<ErrorState> => {
            const suggestionContent = error.suggestion?.content ?? null;
            const startIndexSuggestion = error.suggestion?.startIndex ?? null;
            const endIndexSuggestion = error.suggestion?.endIndex ?? null;

            if (error.publicId) {
                await tx.error.update({
                    where: { publicId: error.publicId },
                    data: {
                        startIndexError: error.info.startIndex,
                        endIndexError: error.info.endIndex,
                        errorMessage: error.info.message,
                        errortype: error.info.type,
                        layer: error.info.layer,
                        suggestionContent,
                        startIndexSuggestion,
                        endIndexSuggestion,
                        resolvedAt: error.resolvedAt,
                        dismissedAt: error.dismissedAt,
                    },
                });
                return error;
            }

            const created = await tx.error.create({
                data: {
                    privateDocumentId,
                    startIndexError: error.info.startIndex,
                    endIndexError: error.info.endIndex,
                    errorMessage: error.info.message,
                    errortype: error.info.type,
                    layer: error.info.layer,
                    suggestionContent,
                    startIndexSuggestion,
                    endIndexSuggestion,
                    resolvedAt: error.resolvedAt,
                    dismissedAt: error.dismissedAt,
                },
            });

            return { ...error, publicId: created.publicId };
        }),
    );
}

async function writeProofAttempt(tx: TransactionClient, privateDocumentId: number, state: HotDocumentState): Promise<void> {
    /**
     * Write the proof attempt to the database.
     */
    await tx.proofAttempt.create({
        data: {
            privateDocumentId,
            content: state.body.content as unknown as Prisma.InputJsonValue,
            versionName: `Snapshot at ${new Date().toISOString()}`,
            manualSave: false,
            errorCount: state.body.errors.length,
        },
    });
}

async function syncMathStatementLinks(tx: TransactionClient, privateDocumentId: number, state: HotDocumentState): Promise<void> {
    /**
     * Sync the math statement links to the database.
     */
    /**
     * TODO: Diff `state.question.selectedMathStatements` against junction rows.
     * Resolve MathStatement publicIds → privateMathStatementId, upsert/delete DocumentMathStatements.
     */
    void tx;
    void privateDocumentId;
    void state;
}

async function syncLemmaLinks(tx: TransactionClient, privateDocumentId: number, state: HotDocumentState): Promise<void> {
    /**
     * Sync the lemma links to the database.
     */
    /**
     * Diff `state.question.selectedLemmas` against DocumentLemma rows.
     * Resolve Lemma publicIds → privateLemmaId, upsert/delete DocumentLemma.
     */
    void tx;
    void privateDocumentId;
    void state;
}
