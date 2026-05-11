import { Delta, DocumentState, AuthenticatedSocket, Timers } from '../../lib/types'
import { updateDatabase, applyDelta, validateDeltaForContent, setUpQuestionTimer} from '../../lib/helpers'


export async function onQuestionDelta(
    socket: AuthenticatedSocket,
    documentStates: Map<string, DocumentState>,
    qDelta: Delta,
    socketDocumentMap: Map<string, string>,
    timers: Map<string, Timers>
) {
    // (1) Basic checks
    // Get the joined document ID
    const joinedDocumentId = socketDocumentMap.get(socket.id)

    // Check if the user is authorized to send the question delta
    if (!socket.data.user || !joinedDocumentId) {
        socket.emit('document:qDelta:error', { code: 'UNAUTHORIZED' })
        return
    }
    // Check if the document ID is the same as the one in the question delta
    if (qDelta.documentId !== joinedDocumentId) {
        socket.emit('document:qDelta:error', { code: 'FORBIDDEN' })
        return
    }

    // Get the document state
    const docState = documentStates.get(joinedDocumentId)
    if (!docState) {
        socket.emit('document:qDelta:error', { code: 'DOCUMENT_STATE_MISSING' })
        return
    }

    // Check if the question revision is correct
    if (docState.questionRevision + 1 !== qDelta.revision) {
        socket.emit('document:qDelta:error', { code: 'REVISION_MISMATCH', expectedRevision: docState.questionRevision + 1 })
        return
    }

    // Validate the delta
    const qDeltaValidationError = validateDeltaForContent(qDelta, docState.questionContent.length)
    if (qDeltaValidationError) {
        socket.emit('document:qDelta:error', { code: qDeltaValidationError })
        return
    }

    // Log a meaningful delta summary from pre-delta content.
    const removedContent = docState.questionContent.slice(qDelta.startIndex, qDelta.endIndex)
    if (qDelta.type === 'delete') {
        console.log(
            `User deleted "${removedContent}" in question body of document ${joinedDocumentId}`
        )
    } else if (qDelta.type === 'replace') {
        console.log(
            `User replaced "${removedContent}" with "${qDelta.content}" in question body of document ${joinedDocumentId}`
        )
    } else {
        console.log(
            `User inserted "${qDelta.content}" in question body of document ${joinedDocumentId}`
        )
    }

    // (3) Set the document state. DO NOT TOUCH the content and revision. Only update the question buffer and question content.
    documentStates.set(joinedDocumentId, {
        questionContent: applyDelta(docState.questionContent, qDelta),
        questionRevision: qDelta.revision,
        questionBuffer: [...docState.questionBuffer, qDelta],
        
        content: docState.content,
        contentId: docState.contentId,
        revision: docState.revision,
        buffer: [...docState.buffer],
        errors: docState.errors,
        coursePublicId: docState.coursePublicId,
        proofType: docState.proofType,
        selectedMathStatements: docState.selectedMathStatements,
    })

    // Get the updated document state
    const updatedDocState = documentStates.get(joinedDocumentId)
    if (!updatedDocState) {
        socket.emit('document:qDelta:error', { code: 'DOCUMENT_STATE_MISSING' })
        return
    }

    // Emit the delta ack. 
    socket.emit('document:qDelta:ack', { revision: qDelta.revision })
    
    // (4) Set up the question textbox timer. This is for the database.
    setUpQuestionTimer(joinedDocumentId, timers, documentStates, socket)

    // (5) Persist to database to save everything the user typed in RAM

    try{
        // Check if the question buffer is greater than 50
        if (updatedDocState.questionBuffer.length >= 50) {

            // Try to update the database
            try {
                await updateDatabase(joinedDocumentId, updatedDocState, documentStates, false, true)

                // Clear autosave timer for proving statement (persisted eagerly).
                clearTimeout(timers.get(joinedDocumentId)?.questionTimeout)
                
            } catch (error) {
                console.error(`Persist failed for document ${joinedDocumentId}:`, error)
                socket.emit('document:qDelta:error', { code: 'PERSIST_FAILED' })
                return
            }

            socket.emit('document:qDelta:persisted', {
                message: 'Proving statement changes persisted to database.',
            })
        }
    }catch (error) {
        console.error('Unhandled document:qDelta error:', error)
        socket.emit('document:qDelta:error', { code: 'INTERNAL_ERROR' })
    }

}