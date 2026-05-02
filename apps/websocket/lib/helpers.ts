import { Delta, DocumentState, ErrorState } from '@/lib/types'
import { prisma } from '@/lib/prisma'


// Update the database with the current document state, clear buffer. 
export async function updateDatabase(documentPublicId: string, updatedDocState: DocumentState, documentStates: Map<string, DocumentState>, clearBuffer: boolean = true) {
    try {

        await prisma.$transaction(async (tx) => {
             // Update the document's lastEdited timestamp
             // TODO: is there a way to update the docbody and that updates the document automatically?
            const updatedDocument = await tx.document.update({
                where: { publicId: documentPublicId },
                data: { lastEdited: new Date() }
            })

            // Update the document body with the new content
            await tx.documentBody.upsert({
                where: { publicId: updatedDocState.contentId },
                update: { content: updatedDocState.content },
                create: {
                    content: updatedDocState.content,
                    privateDocumentId: updatedDocument.privateId
                }
            })

            // Add a new row to the proofAttempt table with the updated content and a reference to the document
            await tx.proofAttempt.create({
                data: {
                    privateDocumentId: updatedDocument.privateId,
                    content: updatedDocState.content,
                    versionName: `Snapshot at ${new Date().toISOString()}`,
                    errorCount: updatedDocument.numErrors
                }
            }) 
        })

        // If db succeeds: Update the document state in memory with the new content and clear the buffer

        documentStates.set(documentPublicId, {
                content: updatedDocState.content,
                contentId: updatedDocState.contentId,
                revision: updatedDocState.revision,
                buffer: clearBuffer ? [] : updatedDocState.buffer,
                errorCount: updatedDocState.errorCount
        })

    }catch(error){
        console.error(`Error updating database for document ${documentPublicId}:`, error)
    }
    
}

// Apply the delta changes to the current document hot state
export function applyDelta(content: string, delta: Delta): string {
    switch (delta.type) {
        case 'insert':
            return content.slice(0, delta.startIndex) + delta.content + content.slice(delta.startIndex)
        case 'delete':
            return content.slice(0, delta.startIndex) + content.slice(delta.endIndex)
        case 'replace':
            return content.slice(0, delta.startIndex) + delta.content + content.slice(delta.endIndex)
        default:
            throw new Error(`Unknown delta type: ${delta.type}`)
    }
}

export function applyDeltatoErrors(errors: ErrorState[], delta: Delta): ErrorState[] {
    return errors.map(error => {
        // if the error is resolved or dismissed, we don't need to update its position
        if (error.resolvedAt || error.dismissedAt) {
            return error
        }

        if (delta.type === 'insert') {
            // Case 1: If inserting delta before error, shift error to the right
            if (delta.startIndex <= error.startIndexError){
                error.startIndexError += delta.content.length
                error.endIndexError += delta.content.length
            }
            // Case 2: If inserting delta in the middle, shift error end index to the right
            else if (delta.startIndex > error.startIndexError && delta.startIndex < error.endIndexError){
                error.endIndexError += (delta.content.length)
            }
        }

        else if (delta.type === 'delete') {
            // Case 1: If delta start and end is way before the error, shift error to the left
            if (delta.endIndex <= error.startIndexError){
                error.startIndexError -= (delta.endIndex - delta.startIndex)
                error.endIndexError -= (delta.endIndex - delta.startIndex)
            }
            // Case 2: If delta is completely after the error, do nothing
            // Case 3: If the error is inside the delta's deletion range, mark error as resolved
            else if (delta.startIndex <= error.startIndexError && delta.endIndex >= error.endIndexError){
                error.resolvedAt = new Date()
            }

            // TODO These cases will need another revaluation by the ML pipeline
            // Case 4: Deletion is in the range of the error, but doesn't cover the entire error. Shift the end index to the left.
            else if (error.startIndexError < delta.startIndex  && delta.endIndex < error.endIndexError) {
                error.endIndexError -= (delta.endIndex - delta.startIndex)
            }

            // Case 5: Deletion starts in the middle of the error and extends beyond it. Shift the end index to the left. 
            else if (delta.startIndex > error.startIndexError && delta.startIndex < error.endIndexError && delta.endIndex >= error.endIndexError) {
                error.endIndexError -= (delta.endIndex - delta.startIndex)
            }

            // Case 6: Deletion starts before the error and ends in the middle of the error. Shift the start index to the right"
            else if (delta.startIndex <= error.startIndexError && delta.endIndex > error.startIndexError && delta.endIndex < error.endIndexError) {
                error.startIndexError += (delta.endIndex - delta.startIndex)
            }

        }

        else if (delta.type === 'replace') {
            const netChange = delta.content.length - (delta.endIndex - delta.startIndex)

            // Case 1: delta starts before the error, shift error by netChange
            if (delta.endIndex <= error.startIndexError) {
                error.startIndexError += netChange
                error.endIndexError += netChange
            }

            // Case 2: delta starts after the error, do nothing

            // TODO: These cases will need another revaluation by the ML pipeline. 
            // Case 3: delta is in the middle of the error, shift error end index by netChange
            else if (delta.startIndex > error.startIndexError && delta.endIndex < error.endIndexError) {
                error.endIndexError += netChange
            }

            // Case 4: delta overlaps start of error
            else if (delta.startIndex <= error.startIndexError && delta.endIndex < error.endIndexError) {
                error.startIndexError = delta.startIndex + delta.content.length
                error.endIndexError += netChange
            }

            // Case 5: delta overlaps end of error
            else if (delta.startIndex > error.startIndexError && delta.startIndex < error.endIndexError && delta.endIndex >= error.endIndexError) {
                error.endIndexError = delta.startIndex + delta.content.length
            }


            // Case 6: delta completely covers error
            else if (delta.startIndex <= error.startIndexError && delta.endIndex >= error.endIndexError) {
                error.resolvedAt = new Date()
            }

        }

        return error
    })
}

// Function to reindex errors and hints for a document based on its new content after applying deltas. This is called after persisting to DB.
export async function updateErrorAndHintsForDocument(documentId: string, content: string, documentStates: Map<string, DocumentState>) {

}