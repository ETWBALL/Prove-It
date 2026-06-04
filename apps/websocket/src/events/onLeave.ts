import { flushStateToDatabase } from "../lib/DatabaseHelpers";
import { Registry } from "../lib/Registry";
import { AuthorizedSocket, FlushScopes } from "../lib/types";
import { WorkspaceEntry } from "../lib/types/Other";

export async function OnLeave(socket: AuthorizedSocket, workspace: WorkspaceEntry, registry: Registry) {
    /**
     * Handle user leaving a document and clean up registry. Abort everything all Triggers.
     */
    const { documentPublicId } = workspace.session;

    // (1) Abort all ML triggers
    workspace.orchestrator.abortAllMLTriggers(`aborted:leave:${documentPublicId}`);


    // (2) Evict from RAM if last socket for document
    const evictFromRam = registry.isLastSocketForDocument(socket.id, documentPublicId);


    // (3) Flush state to database
    if (evictFromRam) {
        try {
            const flushResult = await flushStateToDatabase(documentPublicId, workspace.orchestrator.getState(), FlushScopes.full);

            if (flushResult.persistedErrors) {
                workspace.orchestrator.getState().body.errors = flushResult.persistedErrors;
            }
        } catch (error) {
            console.error(`Leave aborted: failed to persist document ${documentPublicId}`, error);
            socket.emit("document:leave:error", { code: "PERSIST_FAILED" });
            return;
        }
    }

    registry.handleLeaveRoom(socket.id);
    socket.leave(`document-${documentPublicId}`);
}
