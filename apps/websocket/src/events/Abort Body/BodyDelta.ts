import { Socket } from "socket.io";
import { WorkspaceEntry } from "../../lib/types/Other";
import { Delta } from "../../lib/types";

export const BodyDelta = (socket: Socket, workspace: WorkspaceEntry, delta: Delta) => {
    /**
     * Store delta in doc state, persist to db, trigger error checking if needed.
     */
    // TODO 
    // (1) Apply delta
    workspace.orchestrator.applyDelta(delta);

    // (2) Set up db timer
    workspace.orchestrator.timers.startAutosave();
}