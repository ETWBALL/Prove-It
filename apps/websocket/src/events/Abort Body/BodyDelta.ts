import { Socket } from "socket.io";
import { WorkspaceEntry } from "../../lib/types/Other";
import { Delta } from "../../lib/types";

export const BodyDelta = (socket: Socket, workspace: WorkspaceEntry, delta: Delta) => {
    /**
     * Store delta in doc state, persist to db, trigger error checking if needed.
     */
    const validationError = workspace.orchestrator.applyDelta(delta);
    if (validationError) {
        socket.emit("document:delta:error", { code: validationError });
        return;
    }

    // (2) Set up db timer
    workspace.orchestrator.startAutosaveTimer();
}