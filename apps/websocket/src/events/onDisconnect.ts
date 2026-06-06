import { flushStateToDatabase } from "../lib/DatabaseHelpers";
import { Registry } from "../lib/Registry";
import { AuthenticatedSocket, FlushScopes } from "../lib/types";

export async function OnDisconnect(socket: AuthenticatedSocket, registry: Registry) {
    /**
     * Native Socket.IO disconnect (tab close, network loss).
     * Legacy parity: remove socket from maps, update connection count, flush pending buffers on last
     * connection, clear timers, evict #workspaces when count hits zero (no grace period).
     */
    try {
        if (!socket.data.user) {
            return;
        }

        const documentPublicId = registry.getBoundDocumentPublicId(socket.id);
        if (!documentPublicId) {
            return;
        }

        // (1) Abort ML
        const workspace = registry.getWorkspaceBySocket(socket.id);
        if (workspace) {
            workspace.orchestrator.abortAllMLTriggers(`aborted:disconnect:${documentPublicId}`);
        }

        // (2) Check if this is the last connection for the document
        const isLastConnection = registry.isLastSocketForDocument(socket.id, documentPublicId);

        // (3) Persist pending edits on last connection
        if (isLastConnection && workspace?.orchestrator.hasPendingEdits()) {
            try {
                await flushStateToDatabase(
                    documentPublicId,
                    workspace.orchestrator.getState(),
                    FlushScopes.content,
                );
                workspace.orchestrator.clearPendingEditCounters();
            } catch (error) {
                console.error(
                    `Persist failed on disconnect for document ${documentPublicId}; keeping in-memory state for retry.`,
                    error,
                );
                // (4) Handle disconnect. Retain workspace in RAM for retry.
                registry.onDisconnect(socket.id, {
                    reason: "disconnect",
                    eviction: "retain-workspace",
                });
                // (5) Leave document room
                socket.leave(`document-${documentPublicId}`);
                console.log("A user disconnected");
                return;
            }
        }

        // (6) Handle disconnect. Evict workspace from RAM if last connection.
        registry.onDisconnect(socket.id, {
            reason: "disconnect",
            eviction: isLastConnection ? "immediate" : "none",
        });

        // (7) Leave document room
        socket.leave(`document-${documentPublicId}`);
        console.log("A user disconnected");
        
    } catch (error) {
        console.error(`Unhandled disconnect error for socket ${socket.id}:`, error);
    }
}
