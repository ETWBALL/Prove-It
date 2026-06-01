import { WorkspaceEntry } from "../../lib/types/Other";
import { Socket } from "socket.io";

export function SettingsOpened(_socket: Socket, workspace: WorkspaceEntry) {
    /**
     * Force the settings state to be "open" and abort any previous ML triggers.
     */
    workspace.orchestrator.openSettings();
}
