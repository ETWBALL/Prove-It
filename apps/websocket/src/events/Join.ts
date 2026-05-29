import { Socket } from 'socket.io';
import { Registry } from '../lib/Registry';


export async function Join(clientSocket: Socket, registry: Registry, documentPublicId: string) {
    /**
     * Authorize the user to join the document and make edits.
     */

    // (1) Register the user. Authenticate and Authorize them to make edits
    const {registered, message} = registry.registerUser(clientSocket.id, clientSocket.data.user.publicId, documentPublicId)

    if (!registered) {
        // If registration fails, emit an error and disconnect the socket
        clientSocket.emit('error', message);
        clientSocket.disconnect(true);
    }



}