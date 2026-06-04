import { DocumentOrchestrator } from "./documentOrchestrator";
import {
    BroadcastToDocument,
    EmitToDocument,
    ErrorState,
    HotDocumentState,
    SelectedLemma,
    SelectedMathStatement,
    UserDefinedMathStatement,
    WorkspaceEntry,
} from "./types";
import { LoadedDocument, queryDocument, queryDocumentForUser } from "./DatabaseHelpers";

export class Registry {
    /**
     * Maintains all client connections
     * 
     * 
     * === Private Attributes ===
     * - #workspaces: (documentPublicId, WorkspaceEntry). Workspace entry contains the orchestrator, session, socketId, and registeredSocketIds.
     * - #socketToDocument: (socketId, documentPublicId). Map socketId to documentPublicId for O(1) lookup on events and disconnect.
     * 
     * - broadcast: Emit to all clients in a document room (see BroadcastToDocument).
     * 
     * - isSocketAlive: A function to check if a socket is alive, used for cleaning up stale sockets on new connections.
     * 
     * - disconnectSocket: A function to disconnect a socket, used for cleaning up stale sockets on new connections.
     */

    #workspaces = new Map<string, WorkspaceEntry>();
    #socketToDocument = new Map<string, string>();
    #broadcast: BroadcastToDocument;
    #isSocketAlive: (socketId: string) => boolean;
    #disconnectSocket: (socketId: string) => void;

    constructor(broadcast: BroadcastToDocument, isSocketAlive: (socketId: string) => boolean, disconnectSocket: (socketId: string) => void) {
        /**
         * Websocket boot up: Set up broadcast and registry
         */
        this.#broadcast = broadcast;
        this.#disconnectSocket = disconnectSocket;
        this.#isSocketAlive = isSocketAlive;
    }

    public async registerUser(socketId: string, userId: string, documentPublicId: string): Promise<{ registered: boolean; message: string }> {
        /**
         * (1) Attempt to register a (socket, user, document) session in the registry on join.
         * (2) Check idempotent Joins
         * (3) Disconnect old sockets and add the new one (old socket, user, document). 
         * (4) Removing other sockets for the same user and document
         * (5) Removing the current socket if it's in a different document
         * (6) Load the workspace entry 
         * Return whether registration was successful and a message to emit to the client.
         */ 
        try {
            this.#reconcileStaleSockets(documentPublicId);
            this.#disconnectSameUserTabs(socketId, userId, documentPublicId);

            if (this.#isInDifferentDoc(socketId, documentPublicId)) {
                return { registered: false, message: "ALREADY_IN_DOCUMENT" };
            }

            if (this.#isAlreadyInThisDoc(socketId, documentPublicId)) {
                return { registered: true, message: "IDEMPOTENT_JOIN" };
            }

            if (this.#hasOtherSocketInDoc(documentPublicId, socketId)) {
                return { registered: false, message: "DOCUMENT_LOCKED" };
            }

            const workspace =
                this.#workspaces.get(documentPublicId) ??
                (await this.#ensureWorkspace(documentPublicId, userId));

            if (!workspace) {
                return { registered: false, message: "FORBIDDEN" };
            }

            this.#attachSocket(socketId, userId, documentPublicId, workspace);
            return { registered: true, message: "OK" };
        } catch (error) {
            console.error(
                `[Registry] registerUser failed doc=${documentPublicId} socket=${socketId}:`,
                error,
            );
            return { registered: false, message: "INTERNAL_ERROR" };
        }
    }



    // TODO implement this
    public handleLeaveRoom(socketId: string): void {
        /**
         * Remove the <socketId> from the registry.
         */
        this.#deleteSocket(socketId);
    }

    #bindEmit(documentPublicId: string): EmitToDocument {
        /**
         * Close over <documentPublicId> so DocumentOrchestrator never stores a second copy of the id.
         *
         * - `documentPublicId`: Public id for the document (map key in #workspaces). Must match
         *   WorkspaceEntry.session.documentPublicId and the Socket.IO room `document-${id}`.
         *
         * Returns: EmitToDocument — call as emit(eventName, payload) from the orchestrator.
         * Only used when building a workspace (#createOrchestrator / #fetchDocument).
         */
        return (eventName, payload) =>
            this.#broadcast(eventName, documentPublicId, payload);
    }

    async #loadDocumentState(documentPublicId: string): Promise<HotDocumentState> {
        /**
         * Load the document state from the database. Wrap it in a HotDocumentState interface object. 
         */
        const document = await queryDocument(documentPublicId);
        return this.#formatDocumentState(document);
    }

    #formatDocumentState(document: LoadedDocument): HotDocumentState {
        /**
         * Format the document state into a HotDocumentState interface object. Return the HotDocumentState object.
         */
        const body = document.documentBody;

        return {
            publicId: document.publicId,
            coursePublicId: document.course?.publicId ?? null,
            title: document.title,
            status: document.status,
            proofType: document.proofType,
            proofTypeOrigin: document.proofTypeOrigin,
            settings: {
                isOpen: false,
                strictnessMathStatements: document.strictnessMathStatements,
                strictnessProofType: document.strictnessProofType,
            },
            userDefinedMathStatements: collectUserDefinedMathStatements(document.documentMathStatements),
            body: {
                content: body?.content ?? "",
                revision: 0,
                errors: document.errors
                    .filter((row) => row.resolvedAt == null && row.dismissedAt == null)
                    .map((row) => mapErrorRow(row)),
            },
            question: {
                content: body?.provingStatement ?? "",
                revision: 0,
                provability: document.provability,
                selectedMathStatements: document.documentMathStatements.map((row) =>
                    mapMathStatementRow(row),
                ),
                selectedLemmas: document.usedLemmas.map((row) => mapLemmaRow(row)),
            },
        };
    }

    #createOrchestrator(initialState: HotDocumentState, documentPublicId: string): DocumentOrchestrator {
        /**
         * Construct the per-document orchestrator with room-bound emit.
         *
         * - `initialState`: Loaded HotDocumentState from DB for this document.
         * - `documentPublicId`: Id used for workspace map and Socket.IO room; sole source of truth
         *   for which room broadcasts target.
         *
         * How to use: Call from #fetchDocument / registerUser after state is loaded. Store the
         * returned instance on WorkspaceEntry.orchestrator. Do not construct DocumentOrchestrator elsewhere.
         */
        return new DocumentOrchestrator(initialState, this.#bindEmit(documentPublicId));
    }

    async #ensureWorkspace(documentPublicId: string, userId: string): Promise<WorkspaceEntry | null> {
        const existing = this.#workspaces.get(documentPublicId);
        if (existing) {
            return existing;
        }

        const document = await queryDocumentForUser(documentPublicId, userId);
        if (!document) {
            return null;
        }

        const initialState = this.#formatDocumentState(document);
        const orchestrator = this.#createOrchestrator(initialState, documentPublicId);
        const entry: WorkspaceEntry = {
            session: {
                documentPublicId,
                userId,
                joinedAt: new Date(),
            },
            orchestrator,
            socketId: "",
            registeredSocketIds: new Set(),
        };

        this.#workspaces.set(documentPublicId, entry);
        return entry;
    }

    #removeStaleSocketsForDocument(documentPublicId: string): void {
        /**
         * This documentID might have stale sockets. Remove them
         */
        for (const [otherSocketId, mappedDocId] of this.#socketToDocument) {
            if (mappedDocId !== documentPublicId) {
                continue;
            }
            if (this.#isStale(otherSocketId)) {
                this.#deleteSocket(otherSocketId);
            }
        }
    }

    #disconnectSameUserTabs(socketId: string, userId: string, documentPublicId: string): void {
        /**
         * Disconnect all other sockets for the same user and document. This is to prevent multiple tabs from being open for the same user and document.
         * <documentPublicId> can be opened in multiple tabs. Make sure
        */
        for (const [otherSocketId, mappedDocId] of this.#socketToDocument) {
            if (mappedDocId !== documentPublicId || otherSocketId === socketId) {
                continue;
            }
            if (!this.#isSameUser(otherSocketId, userId)) {
                continue;
            }
            this.#forceDisconnect(otherSocketId);
        }
    }

    #attachSocket(socketId: string, userId: string, documentPublicId: string, workspace: WorkspaceEntry): void {
        /**
         * Attach the <socketId> to the <workspace>.
         */
        workspace.session.userId = userId;
        workspace.session.documentPublicId = documentPublicId;
        workspace.socketId = socketId;
        workspace.registeredSocketIds.add(socketId);
        this.#socketToDocument.set(socketId, documentPublicId);
    }


    public getWorkspaceBySocket(socketId: string): WorkspaceEntry | undefined {
        /**
         * Given <socketId>, return the workspace entry associated with it.
         */
        const documentPublicId = this.#socketToDocument.get(socketId);
        if (!documentPublicId) return undefined;
        return this.#workspaces.get(documentPublicId);
    }

    public getWorkspaceByDocument(documentPublicId: string): WorkspaceEntry | undefined {
        return this.#workspaces.get(documentPublicId);
    }

    // === PRIVATE READ OPERATIONS ===
    #isStale(socketId: string): boolean {
        /**
         * Check if the <socketId> is stale.
         */
        return !this.#isSocketAlive(socketId)
    }

    #isSameUser(otherSocketId: string, userId: string): boolean {
        /**
         * Check if the user associated with <otherSocketId> is the same as <userId>.
         */
        const entry = this.getWorkspaceBySocket(otherSocketId)
        return entry?.session.userId === userId;
    }

    #isSameDocument(otherSocketId: string, documentPublicId: string): boolean {
        /**
         * Check if the document associated with <otherSocketId> is the same as <documentPublicId>.
         */
        const entry = this.getWorkspaceBySocket(otherSocketId)
        return entry?.session.documentPublicId === documentPublicId;
    }

    #isAlreadyInThisDoc(socketId: string, documentPublicId: string): boolean {
        /**
         * Check if the <socketId> is already registered in the same document.
         */
        return this.#socketToDocument.get(socketId) === documentPublicId;
    }

    #isInDifferentDoc(socketId: string, documentPublicId: string): boolean {
        /**
         * Check if the <socketId> is registered in a different document.
         */
        const boundDoc = this.#socketToDocument.get(socketId);
        return boundDoc !== undefined && boundDoc !== documentPublicId;
    }

    #hasOtherSocketInDoc(documentPublicId: string, socketId: string): boolean {
        /**
         * Check if there is another socket (not <socketId>) registered in the same document.
         * <socketId>: The new socket trying to join
         * <documentPublicId>: The document the new socket is trying to join
         */
        const workspace = this.getWorkspaceByDocument(documentPublicId);
        if (!workspace) return false;
        for (const id of workspace.registeredSocketIds) {
            if (id !== socketId) return true;
        }
        return workspace.socketId !== socketId && workspace.socketId.length > 0;
     }

    // === PRIVATE WRITE OPERATIONS ===
    #deleteSocket(socketId: string) {
        /**
         * Remove the <socketId> from the registry.
         */
        const documentPublicId = this.#socketToDocument.get(socketId);
        this.#socketToDocument.delete(socketId);

        if (!documentPublicId) return;

        const workspace = this.#workspaces.get(documentPublicId);
        if (!workspace) return;

        workspace.registeredSocketIds.delete(socketId);
        if (workspace.socketId === socketId) {
            workspace.socketId = "";
        }
    }

    #forceDisconnect(otherId: string): void {
        /**
         * Force disconnect the <otherId> socket and remove it from the registry.
         */
        this.#deleteSocket(otherId);  // remove from map first
        this.#disconnectSocket(otherId);   // then kill the socket
    }
}

type DocumentMathStatementRow = LoadedDocument["documentMathStatements"][number];
type DocumentLemmaRow = LoadedDocument["usedLemmas"][number];
type DocumentErrorRow = LoadedDocument["errors"][number];

function mapErrorRow(row: DocumentErrorRow): ErrorState {
    /**
     * Map the error row to the ErrorState interface object.
     */
    const hasSuggestion =
        row.suggestionContent != null &&
        row.suggestionContent.length > 0 &&
        row.startIndexSuggestion != null &&
        row.endIndexSuggestion != null;

    return {
        publicId: row.publicId,
        info: {
            type: row.errortype,
            message: row.errorMessage ?? "",
            layer: row.layer,
            problematicContent: row.errorMessage ?? "",
            startIndex: row.startIndexError,
            endIndex: row.endIndexError,
        },
        suggestion: hasSuggestion
            ? {
                  content: row.suggestionContent ?? "",
                  startIndex: row.startIndexSuggestion!,
                  endIndex: row.endIndexSuggestion!,
              }
            : undefined,
        resolvedAt: row.resolvedAt,
        dismissedAt: row.dismissedAt,
        isPendingReevaluation: false,
    };
}

function collectUserDefinedMathStatements(rows: LoadedDocument["documentMathStatements"]): Record<string, UserDefinedMathStatement> {
    /**
     * Collect the user-defined math statements from the document. Return a record of publicId to UserDefinedMathStatement.
     */

    const catalog: Record<string, UserDefinedMathStatement> = {};
    for (const row of rows) {
        const { mathStatement } = row;
        if (mathStatement.privateOwnerId == null) continue;
        catalog[mathStatement.publicId] = {
            publicId: mathStatement.publicId,
            information: {
                name: mathStatement.name,
                type: mathStatement.type,
                content: mathStatement.content,
            },
        };
    }
    return catalog;
}

function mapMathStatementRow(row: DocumentMathStatementRow): SelectedMathStatement {
    /**
     * Map the math statement row to the SelectedMathStatement interface object. Given <row>, return the SelectedMathStatement object.
     */


    const { mathStatement } = row;

    const ref: SelectedMathStatement["ref"] =
        mathStatement.privateOwnerId == null
            ? { source: "course", publicId: mathStatement.publicId }
            : { source: "user", publicId: mathStatement.publicId };

    return {
        type: mathStatement.type,
        hintContent: row.hintContent,
        wasUsed: row.wasUsed,
        sufficient: row.sufficient,
        resolvedAt: row.resolvedAt,
        dismissedAt: row.dismissedAt,
        ref,
    };
}

function mapLemmaRow(row: DocumentLemmaRow): SelectedLemma {
    /**
     * Map the lemma row to the SelectedLemma interface object. Given <row>, return the SelectedLemma object.
     */
    const { lemma } = row;
    const ref: SelectedLemma["ref"] =
        lemma.privateOwnerId == null
            ? { source: "course", publicId: lemma.publicId }
            : { source: "user", publicId: lemma.publicId };

    return {
        lemmaStatus: row.lemmaStatus,
        lemmaManualOverride: row.lemmaManualOverride,
        ref,
    };
}
