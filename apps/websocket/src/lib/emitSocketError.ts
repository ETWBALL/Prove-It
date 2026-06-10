import type { Socket } from "socket.io";

/** Client-facing websocket error payload. All domain `:error` events use this shape. */
export interface SocketErrorPayload {
    code: string;
}

export function emitSocketError(socket: Socket, event: string, code: string): void {
    /**
     * Given the <event> (which is a domain-specific event name), emit a structured error to the client on the <event> event.
     */
    socket.emit(event, { code } satisfies SocketErrorPayload);
}
