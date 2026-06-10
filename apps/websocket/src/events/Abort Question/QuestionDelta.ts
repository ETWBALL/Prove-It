import { flushStateToDatabase } from "../../lib/DatabaseHelpers";
import { Socket } from "socket.io";
import { Delta, FlushScopes, WorkspaceEntry } from "../../lib/types";

export function QuestionDelta(socket: Socket, workspaceEntry: WorkspaceEntry, delta: Delta) {
    /**
     * Store delta in doc state, persist to db, trigger provability if needed.
     */

    // (1) Validate delta
    if (!workspaceEntry.orchestrator.isCleanDelta(delta)) {
        socket.emit("document:delta:error", { message: "Delta is not formatted correctly" });
        return;
    }
    // (2) Apply delta
    workspaceEntry.orchestrator.applyDelta(delta);
    
    // (3) Check if delta threshold is met. Persist to db if so
    const timerNeeded = workspaceEntry.orchestrator.checkQuestionDeltaThreshold();
    if (!timerNeeded) {
        flushStateToDatabase(workspaceEntry.session.documentPublicId, workspaceEntry.orchestrator.getState(), FlushScopes.content);
    }

    // (4) Set up db timer
    if (timerNeeded) {
        workspaceEntry.orchestrator.startAutosaveTimer();
    }

    // (5) call statechanges to put a timer on for provability trigger
    workspaceEntry.orchestrator.onStateMutation("question:modified");


}