import { flushStateToDatabase } from "../../lib/DatabaseHelpers";
import { Socket } from "socket.io";
import { Delta, FlushScopes, WorkspaceEntry } from "../../lib/types";

export function QuestionDelta(socket: Socket, workspaceEntry: WorkspaceEntry, delta: Delta) {
    /**
     * Store delta in doc state, persist to db, trigger provability if needed.
     */

    const validationError = workspaceEntry.orchestrator.applyDelta(delta);
    if (validationError) {
        socket.emit("document:delta:error", { code: validationError });
        return;
    }

    // (2) Set up db timer
    workspaceEntry.orchestrator.startAutosaveTimer();

    // (3) Check if delta threshold is met. Persist to db if so
    if (workspaceEntry.orchestrator.checkQuestionDeltaThreshold()) {
        flushStateToDatabase(workspaceEntry.session.documentPublicId, workspaceEntry.orchestrator.getState(), FlushScopes.content);
    }

    // (4) call statechanges to put a timer on for provability trigger
    workspaceEntry.orchestrator.onStateMutation("question:modified");


}