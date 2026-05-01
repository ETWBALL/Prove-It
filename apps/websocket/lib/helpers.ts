import { Delta, DocumentState } from '@/lib/types'
import { prisma } from '@/lib/prisma'


// Update the database with the current document state, clear buffer. 
export async function updateDatabase(documentPublicId: string, updatedDocState: DocumentState, documentStates: Map<string, DocumentState>, clearBuffer: boolean = true) {
    try {

        await prisma.$transaction(async (tx) => {
             // Update the document's lastEdited timestamp
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