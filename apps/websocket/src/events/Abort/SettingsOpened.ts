import { WorkspaceEntry } from "../../lib/types/Other";
import { Socket } from "socket.io";

export function SettingsOpened(_socket: Socket, workspace: WorkspaceEntry) {
    workspace.orchestrator.openSettings();
}
