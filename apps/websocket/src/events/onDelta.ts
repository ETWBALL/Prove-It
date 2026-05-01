import { Socket } from "socket.io";
import { Delta, DocumentState } from '@/lib/types'
import { updateDatabase, applyDelta} from '@/lib/helpers'


export async function onDelta(socket: Socket, documentStates: Map<string, DocumentState>, delta: Delta) {
    console.log(`User typed in document ${delta.documentId}`)


    // Validate revision number for that specific documentID
    const docState = documentStates.get(delta.documentId)
    if (!docState) {
        console.error(`Document with id ${delta.documentId} not found in memory during type event.`)
        return
    }

    if (docState.revision + 1 !== delta.revision) {
        console.error(`Revision mismatch for document ${delta.documentId}. Expected ${docState.revision + 1}, got ${delta.revision}`)
        return
    }

    // Store the delta in the buffer and update the document state
    documentStates.set(delta.documentId, {
        content: applyDelta(docState.content, delta), // Call function
        contentId: docState.contentId,
        revision: delta.revision, // Increment revision
        buffer: [...docState.buffer, delta],
        errorCount: docState.errorCount
    })

    const updatedDocState = documentStates.get(delta.documentId)

    if (!updatedDocState) {
        console.error(`Document with id ${delta.documentId} not found in memory after applying delta.`)
        return
    }
    
    // Send acknowledgement back to the client that sent the delta
    socket.emit('document:delta:ack', { revision: delta.revision })

    // If buffer length exceeds threshold, persist to DB and clear buffer
    if (updatedDocState.buffer.length >= 30) {

        // Update documentBody, Document, proofAttempt
        await updateDatabase(delta.documentId, updatedDocState, documentStates) // persist document function
        
        // Reindex Error, Hint based on new document state.
        await updateErrorAndHintsForDocument(delta.documentId, updatedDocState.content) 

        socket.emit('document:delta:persisted', { message: 'Document changes persisted to database.' })

    }
}