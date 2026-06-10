import { WorkspaceEntry } from "../../lib/types/Other";
import { Socket } from "socket.io";
import { emitSocketError } from "../../lib/emitSocketError";

export function SettingsOpened(socket: Socket, workspace: WorkspaceEntry) {
    /**
     * Force the settings state to be "open" and abort any previous ML triggers.
     */

    // (0) Check if the settings are already open
    if (workspace.orchestrator.isSettingsOpen()) {
        emitSocketError(socket, "document:settings:opened:error", "ALREADY_OPEN");
        return;
    }

    // (1) Open
    workspace.orchestrator.openSettings();

    // (2) Abort any previous ML triggers. We assume user is making changes to the question.
    workspace.orchestrator.abortAllMLTriggers("aborted:settings:opened");
    workspace.orchestrator.stopMlQuestionTimer();

    // (3) Broadcast the state for UI changes
    workspace.orchestrator.broadcastDocumentState();



}

export function SettingsClosed(socket: Socket, workspace: WorkspaceEntry) {
    /**
     * Force the settings state to be "closed" and start a new ML run.
     * lock proof text box (so we can check if the question remains provable)
     */

    // (0) Check if the settings are already closed
    if (!workspace.orchestrator.isSettingsOpen()) {
        emitSocketError(socket, "document:settings:closed:error", "ALREADY_CLOSED");
        return;
    }

    // (1) Close
    workspace.orchestrator.closeSettings();

    // (2) Lock proof text box
    workspace.orchestrator.lockProofTextBox();

    // (3) Run a new ML run
    workspace.orchestrator.runQuestionAnalysis();
    workspace.orchestrator.broadcastDocumentState();

    // (4) Broadcast the state for UI changes
    workspace.orchestrator.broadcastDocumentState();

}
