import { AuthenticatedSocket, DocumentState } from '../../lib/types'
import { updateDatabase } from '../../lib/helpers'


export async function onDisconnect(
    socket: AuthenticatedSocket,
    documentStates: Map<string, DocumentState>,
    socketDocumentMap: Map<string, string>,
    documentConnectionCounts: Map<string, number>
) {
    // Get the documentId associated with this socket
    const documentId = socketDocumentMap.get(socket.id)
    if (!socket.data.user || !documentId) {
        console.error(`Document ID not found for socket ${socket.id}`)
        return
    }

    const currentCount = documentConnectionCounts.get(documentId) ?? 0
    const nextCount = Math.max(0, currentCount - 1)
    if (nextCount === 0) {
        // Last editor disconnected: flush any pending deltas and clear RAM.
        const docState = documentStates.get(documentId)
        if (docState && docState.buffer.length > 0) {
            try {
                await updateDatabase(documentId, docState, documentStates) // persist document function
            } catch (error) {
                console.error(`Persist failed on disconnect for document ${documentId}; keeping in-memory state for retry.`, error)
                socketDocumentMap.delete(socket.id)
                documentConnectionCounts.delete(documentId)
                return
            }
        }
        socketDocumentMap.delete(socket.id)
        documentConnectionCounts.delete(documentId)
        documentStates.delete(documentId)
    } else {
        socketDocumentMap.delete(socket.id)
        documentConnectionCounts.set(documentId, nextCount)
    }

    console.log('A user disconnected')
}
