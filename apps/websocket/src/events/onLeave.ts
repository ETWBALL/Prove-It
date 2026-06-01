import { WorkspaceEntry } from "../lib/types/Other";
import { Socket } from "socket.io";


export function OnLeave(socket: Socket, workspace: WorkspaceEntry) {
    /**
     * Handle user leaving a document and clean up registry. Abort everything all Triggers 
     */

    // TODO
}