import { flushStateToDatabase } from "../lib/DatabaseHelpers";
import { Registry, RegistryOnDisconnectOptions } from "../lib/Registry";
import { AuthorizedSocket, FlushScopes } from "../lib/types";
import { WorkspaceEntry } from "../lib/types/Other";
import { emitSocketError } from "../lib/emitSocketError";

export async function OnLeave(socket: AuthorizedSocket, workspace: WorkspaceEntry, registry: Registry) {
    /**
     * Handle user leaving a document and clean up registry. Abort everything all Triggers.
     */
    const { documentPublicId } = workspace.session;

    workspace.orchestrator.abortAllMLTriggers(`aborted:leave:${documentPublicId}`);

    // (1) Evict from RAM if last socket for document
    const evictFromRam = registry.isLastSocketForDocument(socket.id, documentPublicId);
    let eviction: RegistryOnDisconnectOptions["eviction"] = evictFromRam ? "immediate" : "none";

    // (2) Flush state to database before immediate RAM eviction
    if (evictFromRam) {
        try {
            const flushResult = await flushStateToDatabase(documentPublicId, workspace.orchestrator.getState(), FlushScopes.full);

            if (flushResult.persistedErrors) {
                workspace.orchestrator.getState().body.errors = flushResult.persistedErrors;
            }
        } catch (error) {
            console.error(`Leave aborted: failed to persist document ${documentPublicId}`, error);
            emitSocketError(socket, "document:leave:error", "PERSIST_FAILED");
            eviction = "retain-workspace";
        }
    }

    // (3) Detach socket; evict RAM immediately only when this was the last connection
    registry.onDisconnect(socket.id, { reason: "leave", eviction });

    // (4) Leave document room
    socket.leave(`document-${documentPublicId}`);
}
