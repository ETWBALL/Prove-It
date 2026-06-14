import { flushStateToDatabase } from "../../lib/DatabaseHelpers";
import { Socket } from "socket.io";
import { Delta, FlushScopes, WorkspaceEntry } from "../../lib/types";
import { emitSocketError } from "../../lib/emitSocketError";

export function QuestionDelta(socket: Socket, workspaceEntry: WorkspaceEntry, delta: Delta) {
    /**
     * Store delta in doc state, persist to db, trigger provability if needed.
     */
    if (delta.documentId !== workspaceEntry.session.documentPublicId) {
        emitSocketError(socket, "document:question:delta:error", "FORBIDDEN");
        return;
    }

    // (1) Validate delta
    const validationError = workspaceEntry.orchestrator.isCleanDelta(delta);
    if (validationError) {
        emitSocketError(socket, "document:question:delta:error", validationError);
        return;
    }
    // (2) Apply delta
    workspaceEntry.orchestrator.applyDelta(delta);
    
    // (3) Check if delta threshold is met. Persist to db if so. Reset question delta counter.
    const timerNeeded = workspaceEntry.orchestrator.checkQuestionDeltaThreshold();
    if (!timerNeeded) {
        // Persist in the background: the delta is already applied + acked below, so contain (don't
        // rethrow) any flush failure. The autosave timer / next flush retries on failure.
        void flushStateToDatabase(
            workspaceEntry.session.documentPublicId,
            workspaceEntry.orchestrator.getState(),
            FlushScopes.content,
        ).catch((error) => {
            console.error(
                `Background flush failed for document ${workspaceEntry.session.documentPublicId}:`,
                error,
            );
        });
        workspaceEntry.orchestrator.resetDeltaCounters("question");
    }

    // (4) Set up db timer
    if (timerNeeded) {
        workspaceEntry.orchestrator.startAutosaveTimer();
    }

    // (5) call statechanges to put a timer on for provability trigger
    workspaceEntry.orchestrator.onStateMutation("question:modified");

    // (6) Ack in-flight delta so the client advances revision + base content
    socket.emit("document:question:delta:ack", { revision: delta.revision });


}