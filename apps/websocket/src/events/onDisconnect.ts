import { Socket } from "socket.io";
import { WorkspaceEntry } from "../lib/types/Other";


export function OnDisconnect(socket: Socket, workspace: WorkspaceEntry) {
    /**
     * Handle user disconnections and clean up registry. Abort everything all Triggers. Set up a grace period for users to reconnect.
     */

    // TODO
}