import { Delta, DocumentState, AuthenticatedSocket } from '../../lib/types'
import { updateDatabase, applyDelta, applyDeltatoErrors} from '../../lib/helpers'


export async function onDelta(socket: AuthenticatedSocket, documentStates: Map<string, DocumentState>, delta: Delta, socketDocumentMap: Map<string, string>) {
    const joinedDocumentId = socketDocumentMap.get(socket.id)
    
    // Check if the user is authorized to send the delta
    if (!socket.data.user || !joinedDocumentId) {
        socket.emit('document:delta:error', { code: 'UNAUTHORIZED' })
        return
    }
    // Check if the document ID is the same as the one in the delta
    if (delta.documentId !== joinedDocumentId) {
        socket.emit('document:delta:error', { code: 'FORBIDDEN' })
        return
    }

    console.log(`User typed in document ${joinedDocumentId}`)


    // Validate revision number for that specific documentID
    const docState = documentStates.get(joinedDocumentId)
    if (!docState) {
        console.error(`Document with id ${joinedDocumentId} not found in memory during type event.`)
        return
    }

    if (docState.revision + 1 !== delta.revision) {
        console.error(`Revision mismatch for document ${joinedDocumentId}. Expected ${docState.revision + 1}, got ${delta.revision}`)
        return
    }

    // Might contain triggers for ML, need to get the previous content first before applyDelta changes docbody.
    const {updatedErrors, mlErrors} = applyDeltatoErrors(docState.errors, delta, docState.content) // Get the updated error states after applying the delta. This is important to do before we apply the delta to the document content.

    // If we detect even one error changed, trigger ML pipeline and send a message to the client to remove error from frontend
    if (mlErrors.length > 0){
        socket.emit('document:errors:removed', {errorIds: mlErrors.map(e => e.publicId)})
    }

    // Store the delta in the buffer and update the document state
    documentStates.set(joinedDocumentId, {
        content: applyDelta(docState.content, delta), // Call function
        contentId: docState.contentId,
        revision: delta.revision, // Increment revision
        buffer: [...docState.buffer, delta],
        errors: updatedErrors,
    })

    const updatedDocState = documentStates.get(joinedDocumentId)

    if (!updatedDocState) {
        console.error(`Document with id ${joinedDocumentId} not found in memory after applying delta.`)
        return
    }
    
    // Send acknowledgement back to the client that sent the delta
    socket.emit('document:delta:ack', { revision: delta.revision })

    // If buffer length exceeds threshold, persist to DB and clear buffer

    // TODO: There should also be a save if someone copy and pasted a huge delta. We can add a size property to the delta and if it exceeds a certain size, we persist to DB immediately. For now, we will just rely on the buffer length.
    if (updatedDocState.buffer.length >= 30) {

        // Update documentBody, Document, proofAttempt, Errors and suggestions
        await updateDatabase(joinedDocumentId, updatedDocState, documentStates, ) // persist document function

        socket.emit('document:delta:persisted', { message: 'Document changes persisted to database.' })

    }
}