import { Messenger, WorkspaceEntry } from "./types";

export class Registry {
    /**
     * Maintains all client connections
     * 
     * 
     * === Private Attributes ===
     * - #workspaces: (documentPublicId, WorkspaceEntry). Workspace entry contains the orchestrator, session, socketId, and registeredSocketIds.
     * - #socketToDocument: (socketId, documentPublicId). Map socketId to documentPublicId for O(1) lookup on events and disconnect.
     * 
     * - messenger: A function to send messages back to the client associated with this document.
     * 
     * - isSocketAlive: A function to check if a socket is alive, used for cleaning up stale sockets on new connections.
     * 
     * - disconnectSocket: A function to disconnect a socket, used for cleaning up stale sockets on new connections.
     */

    #workspaces = new Map<string, WorkspaceEntry>();
    #socketToDocument = new Map<string, string>();
    #messenger: Messenger;
    #isSocketAlive: (socketId: string) => boolean;
    #disconnectSocket: (socketId: string) => void;

    constructor(messenger: Messenger, isSocketAlive: (socketId: string) => boolean, disconnectSocket: (socketId: string) => void) {
        /**
         * Websocket boot up: Set up messengers and registry
         */
        this.#messenger = messenger;
        this.#disconnectSocket = disconnectSocket;
        this.#isSocketAlive = isSocketAlive;
    }

    // TODO implement this
    public registerUser(socketId: string, userId: string, documentPublicId: string): {registered: boolean, message: string} {
        /**
         * (1) Attempt to register a (socket, user, document) session in the registry on join.
         * (2) Check idempotent Joins
         * (3) Disconnect old sockets and add the new one (old socket, user, document). 
         * (4) Removing other sockets for the same user and document
         * (5) Removing the current socket if it's in a different document
         * (6) Load the workspace entry 
         * Return whether registration was successful and a message to emit to the client.
         */ 
        void socketId;
        void userId;
        void documentPublicId;
        return {registered: false, message: "Registration failed"}
    }


    // TODO implement this
    public handleLeaveRoom(socketId: string): void {

    }

    // TODO implement this
    public updateDocumentState(documentPublicId: string, clearBodyBuffer: boolean, clearQuestionBuffer: boolean): Promise<void> {
        /**
         * Take <documentPublicId> and save its state to db.
        */
        void documentPublicId;
        void clearBodyBuffer;
        void clearQuestionBuffer;
        return Promise.resolve()
    }

    // TODO implement this
    async #fetchDocument(documentPublicId: string): Promise<WorkspaceEntry> {
        /**
         * Fetch document details and populate workspace entry.
         */
        void documentPublicId;
        return Promise.resolve({
            session: {} as WorkspaceEntry["session"],
            orchestrator: {} as WorkspaceEntry["orchestrator"],
            socketId: "",
            registeredSocketIds: new Set(),
        });
    }


    getWorkspaceBySocket(socketId: string): WorkspaceEntry | undefined {
        /**
         * Given <socketId>, return the workspace entry associated with it.
         */
        const documentPublicId = this.#socketToDocument.get(socketId);
        if (!documentPublicId) return undefined;
        return this.#workspaces.get(documentPublicId);
    }

    getWorkspaceByDocument(documentPublicId: string): WorkspaceEntry | undefined {
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
