import { flushStateToDatabase } from "../../lib/DatabaseHelpers";
import { Socket } from "socket.io";
import { Delta, FlushScopes, WorkspaceEntry } from "../../lib/types";
import { emitSocketError } from "../../lib/emitSocketError";

export function QuestionDelta(socket: Socket, workspaceEntry: WorkspaceEntry, delta: Delta) {
    /**
     * Store delta in doc state, persist to db, trigger provability if needed.
     */
    // (1) Validate delta
    const validationError = workspaceEntry.orchestrator.isCleanDelta(delta);
    if (validationError) {
        emitSocketError(socket, "document:qDelta:error", validationError);
        return;
    }
    // (2) Apply delta
    workspaceEntry.orchestrator.applyDelta(delta);
    
    // (3) Check if delta threshold is met. Persist to db if so. Reset question delta counter.
    const timerNeeded = workspaceEntry.orchestrator.checkQuestionDeltaThreshold();
    if (!timerNeeded) {
        flushStateToDatabase(workspaceEntry.session.documentPublicId, workspaceEntry.orchestrator.getState(), FlushScopes.content);
        workspaceEntry.orchestrator.resetDeltaCounters("question");
    }

    // (4) Set up db timer
    if (timerNeeded) {
        workspaceEntry.orchestrator.startAutosaveTimer();
    }

    // (5) call statechanges to put a timer on for provability trigger
    workspaceEntry.orchestrator.onStateMutation("question:modified");

    // (6) Emit state change event
    socket.emit("document:state:changed", workspaceEntry.orchestrator.getState());


}