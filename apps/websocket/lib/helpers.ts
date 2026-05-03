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


            await Promise.all(updatedDocState.errors.map(async (error) => {
                return tx.error.update({
                    where: { publicId: error.publicId },
                    data: {
                        startIndexError: error.startIndexError,
                        endIndexError: error.endIndexError,
                        resolvedAt: error.resolvedAt,
                        dismissedAt: error.dismissedAt,
                        suggestionContent: error.suggestion?.suggestionContent ?? null,
                        startIndexSuggestion: error.suggestion ? error.suggestion.startIndexSuggestion : undefined,
                        endIndexSuggestion: error.suggestion ? error.suggestion.endIndexSuggestion : undefined,
                    }
                })
            }))
        })

        // If db succeeds: Update the document state in memory with the new content and clear the buffer
        documentStates.set(documentPublicId, {
                content: updatedDocState.content,
                contentId: updatedDocState.contentId,
                revision: updatedDocState.revision,
                buffer: clearBuffer ? [] : updatedDocState.buffer,
                errors: updatedDocState.errors
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

function shiftRange(start:number, end: number, delta: Delta, resolvedAt: Date | null, type: string, problematicContent: string): [number, number, boolean, Date | null] {
    
    let newStart = start
    let newEnd = end

    let triggered = false

    if (delta.type === 'insert') {
            // Case 1: If inserting delta before error, shift error to the right
            if (delta.startIndex <= start){
                newStart += delta.content.length
                newEnd += delta.content.length
            }

            // ML TRIGGER
            // Case 2: If inserting delta in the middle, shift error end index to the right
            else if (delta.startIndex > start && delta.startIndex < end){
                resolvedAt = new Date()
                console.log(`ML Trigger: Insertion in the middle of an "${type}". Original error content: "${problematicContent}". Marking error as resolved for re-evaluation.`)
                triggered = true
                newEnd += (delta.content.length)
            }
        }

    else if (delta.type === 'delete') {
        // Case 1: If delta start and end is way before the error, shift error to the left
        if (delta.endIndex <= start){
            newStart -= (delta.endIndex - delta.startIndex)
            newEnd -= (delta.endIndex - delta.startIndex)
        }
        // Case 2: If delta is completely after the error, do nothing
        // Case 3: If the error is inside the delta's deletion range, mark error as resolved
        else if (delta.startIndex <= start && delta.endIndex >= end){
            resolvedAt = new Date()
            console.log(`ML Trigger: Deletion covers entire error. Original error content: "${problematicContent}". Marking error as resolved for re-evaluation.`)
            triggered = true
        }

        // Case 4: Deletion is in the range of the error, but doesn't cover the entire error. Shift the end index to the left.
        else if (start < delta.startIndex  && delta.endIndex < end) {
            resolvedAt = new Date()
            console.log(`ML Trigger: Deleted part of ${type}. Original ${type} content: "${problematicContent}". Marking ${type} as resolved for re-evaluation.`)
            triggered = true
            newEnd -= (delta.endIndex - delta.startIndex)
        }

        // Case 5: Deletion starts in the middle of the error and extends beyond it. Shift the end index to the left. 
        else if (delta.startIndex > start && delta.startIndex < end && delta.endIndex >= end) {
            resolvedAt = new Date()
            console.log(`ML Trigger: Deleted part of ${type} and extends beyond it. Original ${type} content: "${problematicContent}". Marking ${type} as resolved for re-evaluation.`)
            triggered = true
            newEnd = delta.startIndex
        }

        // Case 6: Deletion starts before the error and ends in the middle of the error. Shift the start index to the right"
        else if (delta.startIndex <= start && delta.endIndex > start && delta.endIndex < end) {
            resolvedAt = new Date()
            console.log(`ML Trigger: Deleted before the "${type}" till halfway. Original ${type} content: "${problematicContent}". Marking ${type} as resolved for re-evaluation.`)
            triggered = true

            const originalStartIndexError = start
            newStart = delta.startIndex
            newEnd -= (delta.endIndex - originalStartIndexError)
        }

    }
    else if (delta.type === 'replace') {
        const netChange = delta.content.length - (delta.endIndex - delta.startIndex)

        // Case 1: delta starts before the error, shift error by netChange
        if (delta.endIndex <= start) {
            newStart += netChange
            newEnd += netChange
        }

        // Case 2: delta starts after the error, do nothing

        // Case 3: delta is in the middle of the error, shift error end index by netChange
        else if (delta.startIndex > start && delta.endIndex < end) {
            resolvedAt = new Date()
            console.log(`ML Trigger: Replacement in the middle of an ${type}. Original ${type} content: "${problematicContent}". Marking ${type} as resolved for re-evaluation.`)
            triggered = true
            newEnd += netChange
        }

        // Case 4: delta overlaps start of error
        else if (delta.startIndex <= start && delta.endIndex < end) {
            resolvedAt = new Date()
            console.log(`ML Trigger: Replacement overlaps start of an ${type}. Original ${type} content: "${problematicContent}". Marking ${type} as resolved for re-evaluation.`)
            triggered = true
            
            newStart = delta.startIndex + delta.content.length
            newEnd += netChange
        }

        // Case 5: delta overlaps end of error
        else if (delta.startIndex > start && delta.startIndex < end && delta.endIndex >= end) {
            resolvedAt = new Date()
            console.log(`ML Trigger: Replacement overlaps end of an ${type}. Original ${type} content: "${problematicContent}". Marking ${type} as resolved for re-evaluation.`)
            triggered = true
            newEnd = delta.startIndex + delta.content.length
        }

        // Case 6: delta completely covers error
        else if (delta.startIndex <= start && delta.endIndex >= end) {
            resolvedAt = new Date()
            console.log(`ML Trigger: Replacement completely covers an ${type}. Original ${type} content: "${problematicContent}". Marking ${type} as resolved for re-evaluation.`)
            triggered = true
        }

    }

    // Guard against negative indices
    newStart = Math.max(0, newStart)
    newEnd = Math.max(0, newEnd)

    if (newEnd <= newStart) {
        resolvedAt = new Date()
        triggered = true
    }

    return [newStart, newEnd, triggered, resolvedAt ]
}

export function applyDeltatoErrors(errors: ErrorState[], delta: Delta, documentContent: string): { updatedErrors: ErrorState[], mlErrors: ErrorState[] } {
    const mlErrors: ErrorState[] = []
    const updatedErrors: ErrorState[] = []

    for (const error of errors) {
        // if the error is resolved or dismissed, we don't need to update its position OR trigger the ML pipeline
        if (error.resolvedAt || error.dismissedAt) {
            updatedErrors.push(error)
            continue
        }

        // Grab the content before indices are changed for ML trigger comparison later
        const problematicContent =  documentContent.slice(error.startIndexError, error.endIndexError)
        
        // Change this error's/suggestion's indices based on the delta. Detect if this error triggers ML.
        const [newStartError, newEndError, triggered, resolvedAt] = shiftRange(error.startIndexError, error.endIndexError, delta, error.resolvedAt, 'error', problematicContent)
        

        // If ML is triggered, mark the error as resolved and add to mlErrors.
        let updatedError: ErrorState = {
            ...error,
            startIndexError: newStartError, 
            endIndexError: newEndError,
            resolvedAt,
            problematicContent: triggered ? problematicContent : undefined,
            MLTriggered: triggered
        }
        
        // Only update suggestion if error is not triggered AND suggestion actually exists
        const [newStart, newEnd] = !triggered && error.suggestion ? shiftRange(error.suggestion?.startIndexSuggestion ?? 0, error.suggestion?.endIndexSuggestion ?? 0, delta, error.resolvedAt, 'suggestion', error.suggestion?.suggestionContent ?? '') : [0, 0]
        if (!triggered) {
            updatedError.suggestion = error.suggestion ? {
                    suggestionContent: error.suggestion.suggestionContent,
                    startIndexSuggestion: newStart, // For simplicity, we will shift the suggestion indices the same way as the error indices. This is not 100% accurate but it is a reasonable approximation. We can improve this later if needed.
                    endIndexSuggestion: newEnd
                } : null
        } else {
            updatedError.suggestion = error.suggestion ? {
                suggestionContent: error.suggestion.suggestionContent,
                startIndexSuggestion: 0, // stale
                endIndexSuggestion: 0 // stale
            } : null
        }

        if (triggered) {
            mlErrors.push(updatedError)
        }
        
        updatedErrors.push(updatedError)
    }

    return {updatedErrors, mlErrors}
}

