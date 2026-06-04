import { WorkspaceEntry } from "../lib/types/Other";



export function SettingsClosed(_socket: Socket, workspace: WorkspaceEntry) {
    /**
     * Handle user closing settings and check if this question is provable. 
     */

    //TODO 
    workspace.orchestrator.closeSettings();
}