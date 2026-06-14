import { Socket } from "socket.io";
import { WorkspaceEntry } from "../../lib/types/Other";
import { Delta } from "../../lib/types";
import { emitSocketError } from "../../lib/emitSocketError";

export const BodyDelta = (socket: Socket, workspace: WorkspaceEntry, delta: Delta) => {
    /**
     * Store delta in doc state, persist to db, trigger error checking if needed.
     */
    if (delta.documentId !== workspace.session.documentPublicId) {
        emitSocketError(socket, "document:delta:error", "FORBIDDEN");
        return;
    }

    const validationError = workspace.orchestrator.isCleanDelta(delta);
    if (validationError) {
        emitSocketError(socket, "document:delta:error", validationError);
        return;
    }

    workspace.orchestrator.applyDelta(delta);

    // (2) Set up db timer
    workspace.orchestrator.startAutosaveTimer();

    // (3) Ack in-flight delta so the client advances revision + base content
    socket.emit("document:delta:ack", { revision: delta.revision });
}