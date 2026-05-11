import { AuthenticatedSocket, DocumentState, Timers } from '../../lib/types'
import { updateDatabase } from '../../lib/helpers'


export async function onLeave(
    socket: AuthenticatedSocket,
    documentStates: Map<string, DocumentState>,
    documentId: string,
    socketDocumentMap: Map<string, string>,
    documentConnectionCounts: Map<string, number>,
    timers: Map<string, Timers>
) {
    try {

        // Get the joined document ID
        const joinedDocumentId = socketDocumentMap.get(socket.id)

        // Check if the user is authorized to leave the document
        if (!socket.data.user || !joinedDocumentId) {
            socket.emit('document:leave:error', { code: 'UNAUTHORIZED' })
            return
        }

        // Check if the document ID is the same as the one in the leave
        if (joinedDocumentId !== documentId) {
            socket.emit('document:leave:error', { code: 'FORBIDDEN' })
            return
        }

        // Get the current count of connections to the document
        const currentCount = documentConnectionCounts.get(documentId) ?? 0
        const nextCount = Math.max(0, currentCount - 1)
        if (nextCount === 0) {
            const existingTimers = timers.get(documentId)
            if (existingTimers) {
                if (existingTimers.databaseTimeout) clearTimeout(existingTimers.databaseTimeout)
                if (existingTimers.mlTimeout) clearTimeout(existingTimers.mlTimeout)
                if (existingTimers.questionTimeout) clearTimeout(existingTimers.questionTimeout)
                timers.delete(documentId)
            }

            // Last session for this doc in RAM — flush pending body / proving deltas if any.
            const docState = documentStates.get(documentId)

            // Check if the document state exists and the buffer is greater than 0
            if (docState && (docState.buffer.length > 0 || docState.questionBuffer.length > 0)) {
                try {
                    await updateDatabase(
                        documentId,
                        docState,
                        documentStates,
                        docState.buffer.length > 0,
                        docState.questionBuffer.length > 0
                    )
                } catch (error) {
                    console.error(`Leave aborted: failed to persist document ${documentId}`, error)
                    socket.emit('document:leave:error', { code: 'PERSIST_FAILED' })
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

        // Leave the document
        socket.leave(documentId)
        console.log(`User left document ${documentId}`)
    } catch (error) {
        console.error(`Unhandled leave error for document ${documentId}:`, error)
        socket.emit('document:leave:error', { code: 'INTERNAL_ERROR' })
    }
}
