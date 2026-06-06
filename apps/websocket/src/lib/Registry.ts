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
import { flushStateToDatabase, LoadedDocument, queryDocument, queryDocumentForUser } from "./DatabaseHelpers";
import { FlushScopes } from "./types";

export type RegistryOnDisconnectOptions = {
    /** Why the socket is detaching — used for the ML abort reason string. */
    reason: "leave" | "disconnect";
    /**
     * `grace` — wait before flush + RAM eviction (optional; not used on native disconnect).
     * `immediate` — purge timers and delete #workspaces (last connection; caller flushes first).
     * `none` — detach socket only; workspace stays hot (another connection remains).
     * `retain-workspace` — last socket detached after persist failed; workspace kept in RAM for retry.
     */
    eviction: "grace" | "immediate" | "none" | "retain-workspace";
};

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
            this.#removeStaleSocketsForDocument(documentPublicId);
            this.#disconnectSameUserTabs(socketId, userId, documentPublicId);

            if (this.#isInDifferentDoc(socketId, documentPublicId)) {
                return { registered: false, message: "ALREADY_IN_DOCUMENT" };
            }

            if (this.#isAlreadyInThisDoc(socketId, documentPublicId)) {
                const existing = this.#workspaces.get(documentPublicId);
                existing?.orchestrator.stopGracePeriod();
                return { registered: true, message: "IDEMPOTENT_JOIN" };
            }

            if (this.#hasOtherSocketInDoc(documentPublicId, socketId)) {
                return { registered: false, message: "DOCUMENT_LOCKED" };
            }

            // The user is allowed to join the document. Load the workspace entry.
            const workspace =
                this.#workspaces.get(documentPublicId) ??
                (await this.#ensureWorkspace(documentPublicId, userId));

            if (!workspace) {
                return { registered: false, message: "FORBIDDEN" };
            }

            workspace.orchestrator.stopGracePeriod();

            this.#attachSockettoWorkspace(socketId, userId, documentPublicId, workspace);
            return { registered: true, message: "OK" };
        } catch (error) {
            console.error(
                `[Registry] registerUser failed doc=${documentPublicId} socket=${socketId}:`,
                error,
            );
            return { registered: false, message: "INTERNAL_ERROR" };
        }
    }



    public validateAuthorizedAccess(
        socketId: string,
        userId: string | undefined,
        documentPublicId?: string,
    ):
        | { ok: true; workspace: WorkspaceEntry }
        | { ok: false; code: "UNAUTHORIZED" | "FORBIDDEN" } {
        /**
         * Shared gate for protected socket handlers (via authorizeSocket).
         * Always checks registration + user match; when documentPublicId is passed,
         * also checks it matches the socket-bound workspace.
         */
        if (!userId) {
            return { ok: false, code: "UNAUTHORIZED" };
        }

        const boundDocumentId = this.#socketToDocument.get(socketId);
        if (!boundDocumentId) {
            return { ok: false, code: "UNAUTHORIZED" };
        }

        const workspace = this.getWorkspaceBySocket(socketId);
        if (!workspace) {
            return { ok: false, code: "UNAUTHORIZED" };
        }

        if (!this.#isSameUser(socketId, userId)) {
            return { ok: false, code: "FORBIDDEN" };
        }

        if (documentPublicId === undefined) {
            return { ok: true, workspace };
        }

        if (boundDocumentId !== documentPublicId) {
            return { ok: false, code: "FORBIDDEN" };
        }

        if (!this.#isSameDocument(socketId, documentPublicId)) {
            return { ok: false, code: "FORBIDDEN" };
        }

        if (workspace.session.documentPublicId !== documentPublicId) {
            return { ok: false, code: "FORBIDDEN" };
        }

        return { ok: true, workspace };
    }

    public getBoundDocumentPublicId(socketId: string): string | undefined {
        /**
         * Legacy socketDocumentMap.get(socket.id) — which document this socket is attached to.
         */
        return this.#socketToDocument.get(socketId);
    }

    public getDocumentConnectionCount(documentPublicId: string): number {
        /**
         * Legacy documentConnectionCounts.get(documentId) — active sockets on this document.
         */
        const workspace = this.#workspaces.get(documentPublicId);
        if (!workspace) {
            return 0;
        }
        if (workspace.registeredSocketIds.size > 0) {
            return workspace.registeredSocketIds.size;
        }
        return workspace.socketId.length > 0 ? 1 : 0;
    }

    public isLastSocketForDocument(socketId: string, documentPublicId: string): boolean {
        /**
         * True when this socket is the only registered connection for the document.
         * Used to decide whether leaving should flush RAM and evict the workspace.
         * Call before detaching the socket (legacy branched on nextCount === 0).
         */
        if (this.#socketToDocument.get(socketId) !== documentPublicId) {
            return false;
        }
        if (this.getDocumentConnectionCount(documentPublicId) !== 1) {
            return false;
        }
        const workspace = this.#workspaces.get(documentPublicId);
        if (!workspace) {
            return false;
        }
        if (workspace.registeredSocketIds.size === 1) {
            return workspace.registeredSocketIds.has(socketId);
        }
        return workspace.socketId === socketId;
    }

    public onDisconnect(socketId: string, options: RegistryOnDisconnectOptions): void {
        /**
         * Shared teardown when a socket leaves a document (explicit leave or connection drop).
         * Decrements the connection (registeredSocketIds), then evicts or starts grace when last.
         * ML abort is the caller's responsibility (OnLeave / OnDisconnect).
         */
        const documentPublicId = this.#socketToDocument.get(socketId);
        const workspace = documentPublicId ? this.#workspaces.get(documentPublicId) : undefined;

        const wasLastSocket =
            documentPublicId != null && workspace != null
                ? this.isLastSocketForDocument(socketId, documentPublicId)
                : false;

        this.#deleteSocket(socketId);

        if (
            !documentPublicId ||
            !workspace ||
            options.eviction === "none" ||
            options.eviction === "retain-workspace"
        ) {
            return;
        }

        if (!wasLastSocket) {
            return;
        }

        const remaining = this.#workspaces.get(documentPublicId);
        if (!remaining || !this.#hasNoActiveSockets(remaining)) {
            return;
        }

        if (options.eviction === "grace") {
            // Legacy cleared database/ml/question timers when the last connection dropped.
            remaining.orchestrator.purgeAllTimers();
            remaining.orchestrator.startGracePeriod(() => {
                void this.#evictWorkspaceAfterGrace(documentPublicId);
            });
            return;
        }

        if (options.eviction === "immediate") {
            remaining.orchestrator.purgeAllTimers();
            this.#evictWorkspaceFromRam(documentPublicId);
        }
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
        /**
         * Ensure the workspace entry is created for the <documentPublicId> and <userId>.
         */
        
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

    #attachSockettoWorkspace(socketId: string, userId: string, documentPublicId: string, workspace: WorkspaceEntry): void {
        /**
         * Attach the <socketId> to the <workspace>.
         */
        workspace.session.userId = userId;
        workspace.session.documentPublicId = documentPublicId;
        workspace.socketId = socketId;
        workspace.registeredSocketIds.add(socketId);
        this.#socketToDocument.set(socketId, documentPublicId);
    }


    public detachSocket(socketId: string): void {
        /**
         * Remove the socket from #socketToDocument and registeredSocketIds only.
         * Legacy persist-failure path: drop map entries but keep the workspace in #workspaces for retry.
         */
        this.#deleteSocket(socketId);
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

    #hasNoActiveSockets(workspace: WorkspaceEntry): boolean {
        /**
         * Check if the <workspace> has no active sockets.
         */
        return workspace.registeredSocketIds.size === 0 && workspace.socketId === "";
    }

    #evictWorkspaceFromRam(documentPublicId: string): void {
        /**
         * Legacy documentStates.delete — remove workspace from #workspaces when no sockets remain.
         * Caller must flush first on leave/disconnect when needed.
         */
        const workspace = this.#workspaces.get(documentPublicId);
        if (!workspace || !this.#hasNoActiveSockets(workspace)) {
            return;
        }

        workspace.orchestrator.purgeAllTimers();
        this.#workspaces.delete(documentPublicId);
    }

    async #evictWorkspaceAfterGrace(documentPublicId: string): Promise<void> {
        /**
         * Flush and remove a workspace after the disconnect grace period expires.
         */
        const workspace = this.#workspaces.get(documentPublicId);
        if (!workspace || !this.#hasNoActiveSockets(workspace)) {
            return;
        }

        try {
            await flushStateToDatabase(
                documentPublicId,
                workspace.orchestrator.getState(),
                FlushScopes.full,
            );
        } catch (error) {
            console.error(
                `[Registry] Grace eviction failed to persist document ${documentPublicId}; keeping in-memory state for retry.`,
                error,
            );
            return;
        }

        workspace.orchestrator.purgeAllTimers();
        this.#workspaces.delete(documentPublicId);
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
