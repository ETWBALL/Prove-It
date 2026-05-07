import { Delta, DocumentState, AuthenticatedSocket, Timers } from '../../lib/types'
import { updateDatabase, applyDelta, applyDeltatoErrors, validateDeltaForContent, setUpTimers, characterTriggered} from '../../lib/helpers'


export async function onDelta(
    socket: AuthenticatedSocket,
    documentStates: Map<string, DocumentState>,
    delta: Delta,
    socketDocumentMap: Map<string, string>,
    timers: Map<string, Timers>
) {

    // Try to apply the delta
    try {

        // (1) Basic checks
        // Get the joined document ID
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

        // (2) Precautionary steps
        // Get the document state
        const docState = documentStates.get(joinedDocumentId)
        if (!docState) {
            socket.emit('document:delta:error', { code: 'DOCUMENT_STATE_MISSING' })
            return
        }

        // Check if the revision is correct
        if (docState.revision + 1 !== delta.revision) {
            socket.emit('document:delta:error', { code: 'REVISION_MISMATCH', expectedRevision: docState.revision + 1 })
            return
        }

        // Validate the delta
        const deltaValidationError = validateDeltaForContent(delta, docState.content.length)
        if (deltaValidationError) {
            socket.emit('document:delta:error', { code: deltaValidationError })
            return
        }

        // Log a meaningful delta summary from pre-delta content.
        const removedContent = docState.content.slice(delta.startIndex, delta.endIndex)
        if (delta.type === 'delete') {
            console.log(
                `User deleted "${removedContent}" in document ${joinedDocumentId}`
            )
        } else if (delta.type === 'replace') {
            console.log(
                `User replaced "${removedContent}" with "${delta.content}" in document ${joinedDocumentId}`
            )
        } else {
            console.log(
                `User inserted "${delta.content}" in document ${joinedDocumentId}`
            )
        }



        // (3) Begin storing delta in memory
        // Apply the delta to the errors
        const { updatedErrors, mlErrors } = applyDeltatoErrors(docState.errors, delta, docState.content)
        if (mlErrors.length > 0) {
            socket.emit('document:errors:removed', { errorIds: mlErrors.map(e => e.publicId) })
        }

        // Set the document state
        documentStates.set(joinedDocumentId, {
            content: applyDelta(docState.content, delta),
            contentId: docState.contentId,
            revision: delta.revision,
            buffer: [...docState.buffer, delta],
            errors: updatedErrors,
        })


        // Get the updated document state
        const updatedDocState = documentStates.get(joinedDocumentId)
        if (!updatedDocState) {
            socket.emit('document:delta:error', { code: 'DOCUMENT_STATE_MISSING' })
            return
        }

        // Emit the delta ack. 
        socket.emit('document:delta:ack', { revision: delta.revision })

        // (4) Timer setup
        setUpTimers(joinedDocumentId, timers, documentStates, socket)
        

        // (5) Check for additional ML triggers
        if (characterTriggered(delta)) {
            socket.emit('document:delta:ml:trigger', { message: 'ML trigger detected.' })
        }



        // (6) Persist to database to save everything the user typed in RAM
        // Check if the buffer is greater than 30
        if (updatedDocState.buffer.length >= 30) {

            // Try to update the database
            try {
                await updateDatabase(joinedDocumentId, updatedDocState, documentStates)

                // Clear the persistent timer
                clearTimeout(timers.get(joinedDocumentId)?.databaseTimeout)
                
            } catch (error) {
                console.error(`Persist failed for document ${joinedDocumentId}:`, error)
                socket.emit('document:delta:error', { code: 'PERSIST_FAILED' })
                return
            }

            socket.emit('document:delta:persisted', { message: 'Document changes persisted to database.' })
        }

    } catch (error) {
        console.error('Unhandled delta error:', error)
        socket.emit('document:delta:error', { code: 'INTERNAL_ERROR' })
    }
}