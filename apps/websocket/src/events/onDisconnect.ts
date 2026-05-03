import { AuthenticatedSocket, DocumentState } from '../../lib/types'
import { updateDatabase } from '../../lib/helpers'


export async function onDisconnect(socket: AuthenticatedSocket, documentStates: Map<string, DocumentState>, socketDocumentMap: Map<string, string>) {
    // Get the documentId associated with this socket
    const documentId = socketDocumentMap.get(socket.id)
    if (!socket.data.user || !documentId) {
        console.error(`Document ID not found for socket ${socket.id}`)
        return
    }

    // Update the database with what you have
    const docState = documentStates.get(documentId)
    if (docState && docState.buffer.length > 0) {
        await updateDatabase(documentId, docState, documentStates) // persist document function
    }

    // Clean up
    socketDocumentMap.delete(socket.id)
    documentStates.delete(documentId)

    console.log('A user disconnected')
}
