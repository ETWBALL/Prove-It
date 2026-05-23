import { AuthenticatedSocket, AuthorizedSocket, Messenger, WorkspaceEntry } from "./types"

export class Registry {
    /**
     * Maintains all client connections
     * 
     * 
     * === Private Attributes ===
     * - sessions: Maintains all <documentId, WorkspaceEntry> connections. Workspace contains information about a single document, 
     *   such as # of active usersockets, document session, document orchestrator etc.
     * 
     * - messenger: A function to send messages back to the client associated with this document.
     * 
     * - isSocketAlive: A function to check if a socket is alive, used for cleaning up stale sockets on new connections.
     * 
     * - disconnectSocket: A function to disconnect a socket, used for cleaning up stale sockets on new connections.
     */

    #sessions: Map<string, WorkspaceEntry>;
    #messenger: Messenger;
    #isSocketAlive: (socketId: string) => boolean;
    #disconnectSocket: (socketId: string) => void;

    constructor(messenger: Messenger, isSocketAlive: (socketId: string) => boolean, disconnectSocket: (socketId: string) => void) {
        /**
         * Websocket boot up: Set up messengers and registry
         */
        this.#sessions = new Map<string, WorkspaceEntry>()
        this.#messenger = messenger;
        this.#disconnectSocket = disconnectSocket;
        this.#isSocketAlive = isSocketAlive;
    }

    // TODO implement this
    public registerUser(socketId: string, userId: number, documentId: number): {registered: boolean, message: string} {
        /**
         * (1) Attempt to register a (socket, user, document) session in the registry on join.
         * (2) Check idempotent Joins
         * (3) Disconnect old sockets and add the new one (old socket, user, document). 
         * (4) Removing other sockets for the same user and document
         * (5) Removing the current socket if it's in a different document
         * (6) Load the workspace entry 
         * Return whether registration was successful and a message to emit to the client.
         */ 
        return {registered: false, message: "Registration failed"}
    }


    // TODO implement this
    public handleLeaveRoom(socketId: string): void {

    }

    // TODO implement this
    public updateDocumentState(documentId: number, clearBodyBuffer: boolean, clearQuestionBuffer: boolean): Promise<void> {
        /**
         * Take <documentID> and save its state to db.
        */
        return Promise.resolve()
    }

    public get(socketId: string): WorkspaceEntry | undefined {
        /**
         * Get the workspace entry for the given socket ID.
         */
        return this.#sessions.get(socketId);
    }

    async #fetchDocument(documentId: number): Promise<WorkspaceEntry> {
        /**
         * Simply fetch document details and populate workspace entry.
         */
        return Promise.resolve({session: {} as any, orchestrator: {} as any})
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
        const entry = this.#sessions.get(otherSocketId)
        return entry?.session.userId === userId;
    }

    #isSameDocument(otherSocketId: string, documentId: string): boolean {
        /**
         * Check if the document associated with <otherSocketId> is the same as <documentId>.
         */
        const entry = this.#sessions.get(otherSocketId)
        return entry?.session.documentId === documentId;
    }

    #isAlreadyInThisDoc(socketId: string, documentId: string): boolean {
        /**
         * Check if the <socketId> is already registered in the same document.
         */
        const entry = this.#sessions.get(socketId)
        return entry?.session.documentId === documentId;
    }

    #isInDifferentDoc(socketId: string, documentId: string): boolean {
        /**
         * Check if the <socketId> is registered in a different document.
         */
        const entry = this.#sessions.get(socketId);
        return entry !== undefined && entry.session.documentId !== documentId;
    }

    #hasOtherUserInDoc(documentId: string): boolean {
        /**
         * Check if there is another socket (not <socketId>) registered in the same document.
         * <socketId>: The new socket trying to join
         * <documentId>: The document the new socket is trying to join
         */
        const workspaceEntry = this.#sessions.get(documentId);
        return workspaceEntry !== undefined && workspaceEntry.activeSockets.size != 1;
     }

    // === PRIVATE WRITE OPERATIONS ===
    #deleteSocket(socketId: string) {
        /**
         * Remove the <socketId> from the registry.
         */
        this.#sessions.delete(socketId)
    }

    #forceDisconnect(otherId: string): void {
        /**
         * Force disconnect the <otherId> socket and remove it from the registry.
         */
        this.#deleteSocket(otherId);  // remove from map first
        this.#disconnectSocket(otherId);   // then kill the socket
    }
}