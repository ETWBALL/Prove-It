import { Socket } from 'socket.io';
import { Registry } from '../lib/Registry';


export async function onJoin(clientSocket: Socket, registry: Registry, documentId: number) {
    /**
     * Authorize the user to join the document and make edits.
     */

    // (1) Register the user. Authenticate and Authorize them to make edits
    const {registered, message} = registry.registerUser(clientSocket.id, clientSocket.data.user.publicId, documentId)

    if (!registered) {
        // If registration fails, emit an error and disconnect the socket
        clientSocket.emit('error', message);
        clientSocket.disconnect(true);
    }



}