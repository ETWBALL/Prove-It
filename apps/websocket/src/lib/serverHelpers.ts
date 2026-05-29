import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '@prove-it/auth';
import { HotDocumentState, User, WorkspaceEntry } from "./types";
import { Registry } from './Registry';

export function authenticate(io: Server) {
    io.use(async (socket, next) => {
        try {
            // (1) Extract access token safely
            const accessToken = socket.handshake.auth?.accessToken;
            if (!accessToken) {
                return next(new Error('Unauthorized'));
            }

            const { valid, expired, invalid, payload } = await verifyAccessToken(accessToken);

            // (2) Validation check
            if (expired || invalid || !valid) {
                 return next(new Error('Unauthorized'));
            }

            // (3) Attach payload to socket data
            const user = payload as { publicId: string, sessionPublicId: string };
            socket.data.user = user as User;
            next();

        } catch (error) {
            console.error('Authentication error:', error);
            return next(new Error('Unauthorized'));
        }
    });
}

export function authorizeSocket<Args extends any[]>(clientSocket: Socket, registry: Registry, handler: (socket: Socket, workspace: WorkspaceEntry, ...args: Args) => any){
    /**
     * Authorize the socket for document access before executing protected handler.
     */
    return async (...args: Args) => {

        // (1) Check if socket is in registry. If not, reject the request as unauthorized.
        const workspaceEntry = registry.getWorkspaceBySocket(clientSocket.id);
        if (!workspaceEntry) {
            console.warn(`[Security] Blocked unauthorized event from socket: ${clientSocket.id}`)
            clientSocket.emit("error", { message: "Unauthorized" }); 
            return;
        }

        // (2) Authorized, let socket execute handler
        return handler(clientSocket, workspaceEntry, ...args);
    }
}

export async function flushStateToDatabase(documentPublicId: string, state: HotDocumentState): Promise<void> {
    /**
     * (1) Take the current state of the document and flush it to the database.
     * (2) This is called when:
     *     - A document session is evicted after the grace period expires, so we persist the latest state before eviction.
     *     - A user makes significant edits to the document, so we persist the latest state after significant changes.
     */
    return Promise.resolve();
}