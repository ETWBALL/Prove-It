import { Server } from 'socket.io';
import { verifyAccessToken } from '@prove-it/auth';
import { AuthenticatedSocket, AuthorizedSocket, User, WorkspaceEntry } from "./types";
import { Registry } from './Registry';

export interface AuthorizeSocketOptions {
    /** First handler arg must be the document public id and must match the bound workspace. */
    requireDocumentPublicId?: boolean;
    /** Socket event used when access is denied (default: `error`). */
    errorEvent?: string;
}

export function authenticate(io: Server) {
    io.use(async (socket, next) => {
        try {
            const accessToken = socket.handshake.auth?.accessToken;
            if (!accessToken) {
                return next(new Error('Unauthorized'));
            }

            const { valid, expired, invalid, payload } = await verifyAccessToken(accessToken);

            if (expired || invalid || !valid) {
                 return next(new Error('Unauthorized'));
            }

            const user = payload as { publicId: string, sessionPublicId: string };
            socket.data.user = user as User;
            next();

        } catch (error) {
            console.error('Authentication error:', error);
            return next(new Error('Unauthorized'));
        }
    });
}

export function authorizeSocket<Args extends unknown[]>(
    clientSocket: AuthenticatedSocket,
    registry: Registry,
    handler: (socket: AuthorizedSocket, workspace: WorkspaceEntry, ...args: Args) => unknown,
    options?: AuthorizeSocketOptions,
) {
    return async (...args: Args) => {
        const userId = clientSocket.data.user?.publicId;
        const documentPublicId =
            options?.requireDocumentPublicId && typeof args[0] === "string"
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
            const errorEvent = options?.errorEvent ?? "error";
            clientSocket.emit(errorEvent, { code: validation.code });
            return;
        }

        const authorizedSocket = clientSocket as AuthorizedSocket;
        authorizedSocket.data.authorizedDocumentId = validation.workspace.session.documentPublicId;
        authorizedSocket.data.authorizedAt = new Date();

        return handler(authorizedSocket, validation.workspace, ...args);
    };
}
