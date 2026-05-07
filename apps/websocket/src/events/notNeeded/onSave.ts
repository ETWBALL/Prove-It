import { updateDatabase } from "../../../lib/helpers";
import { AuthenticatedSocket, DocumentState, Timers } from "../../../lib/types";


export async function onSave(
    socket: AuthenticatedSocket,
    documentStates: Map<string, DocumentState>,
    documentId: string,
    socketDocumentMap: Map<string, string>,
    timers: Map<string, Timers>
) {
    
    // (1) Basic sanity checks
    // Get the joined document ID
    const joinedDocumentId = socketDocumentMap.get(socket.id)


    // Check if the user is authorized to save the document
    if (!socket.data.user || !joinedDocumentId) {
        socket.emit('document:save:error', { code: 'UNAUTHORIZED' })
        return
    }

    const docState = documentStates.get(joinedDocumentId)
    if (!docState) {
        socket.emit('document:save:error', { code: 'DOCUMENT_STATE_MISSING' })
        return
    }

    // (2) Clear the database timer
    const existingTimers = timers.get(documentId)
    if (existingTimers) {
        if (existingTimers.databaseTimeout) clearTimeout(existingTimers.databaseTimeout)
        timers.delete(documentId) 
    }

    // (3) Persist to database
    try {
        await updateDatabase(documentId, docState, documentStates)
    } catch (error) {
        console.error(`Save aborted: failed to persist document ${documentId}`, error)
        socket.emit('document:save:error', { code: 'PERSIST_FAILED' })
        return
    }

    // (4) Emit the save success event to the client
    socket.emit('document:save:success', { message: 'Document saved successfully.' })
    console.log(`Document ${documentId} saved successfully by user ${socket.data.user.email}`)

}