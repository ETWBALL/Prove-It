import { AuthenticatedSocket, DocumentState } from '../../lib/types'
import { updateDatabase } from '../../lib/helpers'


export async function onLeave(socket: AuthenticatedSocket, documentStates: Map<string, DocumentState>, documentId: string, socketDocumentMap: Map<string, string>) {
    const joinedDocumentId = socketDocumentMap.get(socket.id)
    if (!socket.data.user || !joinedDocumentId) {
        socket.emit('document:leave:error', { code: 'UNAUTHORIZED' })
        return
    }
    if (joinedDocumentId !== documentId) {
        socket.emit('document:leave:error', { code: 'FORBIDDEN' })
        return
    }

    // Update the database with what you have
    const docState = documentStates.get(joinedDocumentId)
    if (docState && docState.buffer.length > 0) {
        await updateDatabase(joinedDocumentId, docState, documentStates) // persist document function
    }

    // Clean up
    documentStates.delete(joinedDocumentId) 
    socketDocumentMap.delete(socket.id)

    // Send message
    socket.leave(joinedDocumentId)
    console.log(`User left document ${joinedDocumentId}`)
}
