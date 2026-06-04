import { Socket } from "socket.io";
import { Registry } from "../lib/Registry";

export function OnDisconnect(socket: Socket, registry: Registry) {
    /**
     * Handle user disconnections and clean up registry. Abort everything all Triggers. Set up a grace period for users to reconnect.
     */
    registry.handleSocketDisconnect(socket.id);
}
