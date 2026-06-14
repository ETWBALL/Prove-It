import { Server } from 'socket.io';
import { verifyAccessToken } from '@prove-it/auth';
import { AuthenticatedSocket, AuthorizedSocket, User, WorkspaceEntry } from "./types";
import { Registry } from './Registry';
import { emitSocketError } from './emitSocketError';

export interface AuthorizeSocketOptions {
    /** First handler arg must be the document public id and must match the bound workspace. */
    requireDocumentPublicId?: boolean;
    /** Domain `:error` event — auth failures and handler errors are emitted here. */
    errorEvent: string;
}

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

            // (3) Set user data on socket
            const user = payload as { publicId: string, sessionPublicId: string };
            socket.data.user = user as User;
            next();

        } catch (error) {
            console.error('Authentication error:', error);
            return next(new Error('Unauthorized'));
        }
    });
}

export function authorizeSocket<Args extends unknown[]>(clientSocket: AuthenticatedSocket, registry: Registry, handler: (socket: AuthorizedSocket, workspace: WorkspaceEntry, ...args: Args) => unknown, options: AuthorizeSocketOptions) {
    /**
     * Authorize the socket for document access before executing protected handler.
     */
    return async (...args: Args) => {
        const userId = clientSocket.data.user?.publicId;
        const documentPublicId =
            options.requireDocumentPublicId && typeof args[0] === "string"
                ? args[0]
                : undefined;

        const validation = registry.validateAuthorizedAccess(
            clientSocket.id,
            userId,
            documentPublicId,
        );

        if (!validation.ok) {
            console.warn(
                `[Security] Blocked event from socket ${clientSocket.id}: ${validation.code}`,
            );
            emitSocketError(clientSocket, options.errorEvent, validation.code);
            return;
        }

        const authorizedSocket = clientSocket as AuthorizedSocket;
        authorizedSocket.data.authorizedDocumentId = validation.workspace.session.documentPublicId;
        authorizedSocket.data.authorizedAt = new Date();

        try {
            return await handler(authorizedSocket, validation.workspace, ...args);
        } catch (error) {
            // (1) Log error
            console.error(
                `[Handler] Unhandled error for socket ${clientSocket.id} on ${options.errorEvent}:`,
                error,
            );
            // (2) Emit error
            emitSocketError(clientSocket, options.errorEvent, "INTERNAL_ERROR");
        }
    };
}
