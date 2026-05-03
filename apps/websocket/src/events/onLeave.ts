import { AuthenticatedSocket, DocumentState } from '../../lib/types'
import { updateDatabase } from '../../lib/helpers'


export async function onLeave(
    socket: AuthenticatedSocket,
    documentStates: Map<string, DocumentState>,
    documentId: string,
    socketDocumentMap: Map<string, Set<string>>,
    documentConnectionCounts: Map<string, number>
) {
    const joinedDocuments = socketDocumentMap.get(socket.id)
    if (!socket.data.user || !joinedDocuments) {
        socket.emit('document:leave:error', { code: 'UNAUTHORIZED' })
        return
    }
    if (!joinedDocuments.has(documentId)) {
        socket.emit('document:leave:error', { code: 'FORBIDDEN' })
        return
    }

    const currentCount = documentConnectionCounts.get(documentId) ?? 0
    const nextCount = Math.max(0, currentCount - 1)
    if (nextCount === 0) {
        // Last editor left: flush in-memory buffer before cleanup.
        const docState = documentStates.get(documentId)
        if (docState && docState.buffer.length > 0) {
            try {
                await updateDatabase(documentId, docState, documentStates) // persist document function
            } catch (error) {
                console.error(`Leave aborted: failed to persist document ${documentId}`, error)
                socket.emit('document:leave:error', { code: 'PERSIST_FAILED' })
                return
            }
        }

        joinedDocuments.delete(documentId)
        if (joinedDocuments.size === 0) {
            socketDocumentMap.delete(socket.id)
        } else {
            socketDocumentMap.set(socket.id, joinedDocuments)
        }
        documentConnectionCounts.delete(documentId)
        documentStates.delete(documentId)
    } else {
        joinedDocuments.delete(documentId)
        if (joinedDocuments.size === 0) {
            socketDocumentMap.delete(socket.id)
        } else {
            socketDocumentMap.set(socket.id, joinedDocuments)
        }
        documentConnectionCounts.set(documentId, nextCount)
    }

    // Send message
    socket.leave(documentId)
    console.log(`User left document ${documentId}`)
}
