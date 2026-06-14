import { WorkspaceEntry } from "../../lib/types/Other";
import { Socket } from "socket.io";

export function SettingsOpened(socket: Socket, workspace: WorkspaceEntry) {
    /**
     * Force the settings state to be "open" and abort any previous ML triggers.
     */

    // (0) Check if the settings are already open
    if (workspace.orchestrator.isSettingsOpen()) {
        workspace.orchestrator.broadcastDocumentState();
        return;
    }

    // (1) Abort in-flight ML first so a completing run cannot apply after settings open.
    workspace.orchestrator.abortAllMLTriggers("aborted:settings:opened");

    // (2) Open settings
    workspace.orchestrator.openSettings();

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
        workspace.orchestrator.broadcastDocumentState();
        return;
    }

    // (1) Close
    workspace.orchestrator.closeSettings();

    // (2) Lock proof text box
    workspace.orchestrator.lockProofTextBox();

    // (3) Run a new ML run. Fire-and-forget: runQuestionAnalysis contains its own errors.
    void workspace.orchestrator.runQuestionAnalysis();

    // (4) Broadcast the state for UI changes
    workspace.orchestrator.broadcastDocumentState();

}
