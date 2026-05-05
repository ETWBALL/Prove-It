import { AuthenticatedSocket, DocumentState, Timers } from '../../lib/types'
import { updateDatabase } from '../../lib/helpers'


export async function onDisconnect(
    socket: AuthenticatedSocket,
    documentStates: Map<string, DocumentState>,
    socketDocumentMap: Map<string, string>,
    documentConnectionCounts: Map<string, number>,
    timers: Map<string, Timers>
) {
    try {
        // Get the document ID
        const documentId = socketDocumentMap.get(socket.id)

        // Already removed (e.g. same-user takeover) or never joined — nothing to do
        if (!documentId) {
            return
        }
        // Check if the user is authorized to disconnect
        if (!socket.data.user) {
            return
        }

        // Clear both timers
        const existingTimers = timers.get(documentId)
        if (existingTimers) {
            if (existingTimers.databaseTimeout) clearTimeout(existingTimers.databaseTimeout)
            if (existingTimers.mlTimeout) clearTimeout(existingTimers.mlTimeout)
            timers.delete(documentId) // Delete the timers from the map
        }

        
        // Get the current count of connections to the document
        const currentCount = documentConnectionCounts.get(documentId) ?? 0
        const nextCount = Math.max(0, currentCount - 1)
        if (nextCount === 0) {
            // Get the document state
            const docState = documentStates.get(documentId)

            // Check if the document state exists and the buffer is greater than 0
            if (docState && docState.buffer.length > 0) {
                // Try to update the database
                try {
                    await updateDatabase(documentId, docState, documentStates)
                } catch (error) {
                    console.error(`Persist failed on disconnect for document ${documentId}; keeping in-memory state for retry.`, error)
                    socketDocumentMap.delete(socket.id)
                    documentConnectionCounts.delete(documentId)
                    return
                }
            }

            // Delete the socket document map and document connection counts
            socketDocumentMap.delete(socket.id)
            documentConnectionCounts.delete(documentId)
            documentStates.delete(documentId)
        } else {
            // Delete the socket document map and document connection counts
            socketDocumentMap.delete(socket.id)
            documentConnectionCounts.set(documentId, nextCount)
        }

        // Log the user disconnected
        console.log('A user disconnected')
    } catch (error) {
        // Log the unhandled disconnect error
        console.error(`Unhandled disconnect error for socket ${socket.id}:`, error)
    }
}
