import { AuthenticatedSocket, Delta, DocumentState, ErrorState, Timers } from '../lib/types'
import { Redis } from '@upstash/redis'
import { prisma } from '@prove-it/db'

const DATABASE_TIMEOUT_MS = 60000 // 1 minute
const ML_TIMEOUT_MS = 35000 // 35 seconds

const MAX_DELTA_CONTENT_LENGTH = 50_000
const MAX_DOCUMENT_LENGTH = 1_000_000
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN
})
// Check for Standard Linguistic Triggers
const trigger1 = ['.', '?', '!', '\n', '\n\n', ':', ';']

// Check for Latex Triggers
const trigger2 = ['$$', '\]', '\therefore', '\qed', '\square']

function isSafeInteger(value: number): boolean {
    return Number.isSafeInteger(value)
}

// This function validates the delta before applying it to the document content.
export function validateDeltaForContent(delta: Delta, contentLength: number): string | null {
    
    // Check if the delta is a safe integer
    if (!isSafeInteger(delta.startIndex) || !isSafeInteger(delta.endIndex) || !isSafeInteger(delta.revision)) {
        return 'INVALID_DELTA_SHAPE'
    }

    // Check if the revision is a positive integer
    if (delta.revision <= 0) {
        return 'INVALID_REVISION'
    }

    // Check if the start index and end index are positive integers
    if (delta.startIndex < 0 || delta.endIndex < 0) {
        return 'INVALID_INDEX'
    }

    // Check if the start index is greater than the end index
    if (delta.startIndex > delta.endIndex) {
        return 'INVALID_RANGE'
    }

    // Check if the start index and end index are within the content length
    if (delta.startIndex > contentLength || delta.endIndex > contentLength) {
        return 'INDEX_OUT_OF_BOUNDS'
    }

    // Check if the content is a string
    if (typeof delta.content !== 'string') {
        return 'INVALID_CONTENT'
    }

    // Check if the content length is greater than the max delta content length
    if (delta.content.length > MAX_DELTA_CONTENT_LENGTH) {
        return 'DELTA_TOO_LARGE'
    }

    // Check if the insert range is valid
    if (delta.type === 'insert' && delta.startIndex !== delta.endIndex) {
        return 'INVALID_INSERT_RANGE'
    }

    // Check if the document size is within the limit
    const removedLength = delta.endIndex - delta.startIndex
    const insertedLength = delta.type === 'delete' ? 0 : delta.content.length
    const nextLength = contentLength - removedLength + insertedLength
    if (nextLength < 0 || nextLength > MAX_DOCUMENT_LENGTH) {
        return 'DOCUMENT_SIZE_LIMIT'
    }

    return null
}


// Update the database with the current document state, clear buffer. 
export async function updateDatabase(documentPublicId: string, updatedDocState: DocumentState, documentStates: Map<string, DocumentState>, clearBuffer: boolean = true) {
    try {

        const updatedDocumentBody = await prisma.$transaction(async (tx) => {
             // Update the document's lastEdited timestamp
            const updatedDocument = await tx.document.update({
                where: { publicId: documentPublicId },
                data: { lastEdited: new Date() }
            })

            // DocumentBody is unique by privateDocumentId, so upsert by that key.
            const persistedDocumentBody = await tx.documentBody.upsert({
                where: { privateDocumentId: updatedDocument.privateId },
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

            return persistedDocumentBody
        })

        // If db succeeds: Update the document state in memory with the new content and clear the buffer
        documentStates.set(documentPublicId, {
                content: updatedDocState.content,
                contentId: updatedDocumentBody.publicId,
                revision: updatedDocState.revision,
                buffer: clearBuffer ? [] : updatedDocState.buffer,
                errors: updatedDocState.errors
        })

    }catch(error){
        console.error(`Error updating database for document ${documentPublicId}:`, error)
        throw error
    }
    
}

// Apply the delta changes to the current document hot state
export function applyDelta(content: string, delta: Delta): string {
    // Validate the delta
    const validationError = validateDeltaForContent(delta, content.length)
    if (validationError) {
        throw new Error(`Invalid delta: ${validationError}`)
    }

    // Apply the delta to the content
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


/**
 * Get the current sentence(s) the user is currently working on. Pack it in one "current" content.
 * @param content - The current hot state of the document in RAM
 * @param startIndex - The latest delta's start index
 * @param endIndex - The latest delta's end index
 */

export function getCurrentSentence(content: string, startIndex: number, endIndex: number): string {
    let newStartIndex;
    let newEndIndex;

    // From startIndex, go backwards and find the beginning of the sentence
    for (let i = startIndex; i >= 0; i--) {
        if (trigger1.includes(content[i]) || trigger2.includes(content[i])) {
            newStartIndex = i + 1
            break
        }
    }

    // From endIndex, go forwards and find the end of the sentence
    for (let i = endIndex; i < content.length; i++) {
        if (trigger1.includes(content[i]) || trigger2.includes(content[i])) {
            newEndIndex = i
            break
        }
    }

    return content.slice(newStartIndex, newEndIndex)
}

/**
 * Get the errors that are associated with the given sentence(s).
 * @param errors - The errors to filter
 * @param sentences - A string that contains 1 or more sentences
 * @returns The errors that are associated with the given sentence(s)
 */
export function getErrorsForSentence(errors: ErrorState[], sentences: string): ErrorState[] {

    // Just extract those errors if the sentences include the problematic content
    return errors.filter(error => 
        !!error.problematicContent && sentences.includes(error.problematicContent)
    );
}   

/**
 * Set up the timers for the document. If the timers already exist, clear them.
 * @param documentId - document's public id
 * @param timers - All of timers associated with this document
 * @param documentStates - The document states map
 * @param socket - The socket for this document
 */
export function setUpTimers(documentId: string, timers: Map<string, Timers>, documentStates: Map<string, DocumentState>, socket: AuthenticatedSocket) {
    const existingTimers = timers.get(documentId)

    // Clear existing timers for this document. Timers may not initially exist    
    if (existingTimers) {
        if (existingTimers.databaseTimeout) clearTimeout(existingTimers.databaseTimeout)
        if (existingTimers.mlTimeout) clearTimeout(existingTimers.mlTimeout)
    }

    // Get the current hot state of the document in RAM
    const updatedDocState = documentStates.get(documentId)

    if (!updatedDocState) {
        console.error(`Document state not found for document ${documentId}`)
        socket.emit('document:delta:error', { code: 'DOCUMENT_STATE_MISSING' })
        return
    }

    // Get the latest delta
    const latestDelta = updatedDocState.buffer.at(-1)

    if (!latestDelta) {
        console.error(`No delta found for document ${documentId}`)
        socket.emit('document:delta:error', { code: 'NO_DELTA_FOUND' })
        return
    }

    // Get the current sentence(s) the user is currently working on
    const currentSentence = getCurrentSentence(updatedDocState.content, latestDelta.startIndex, latestDelta.endIndex)

    // Get the errors that are associated with the current sentence(s)
    const errorsForSentence = getErrorsForSentence(updatedDocState.errors, currentSentence)

    // Set new timers
    timers.set(documentId, {
        databaseTimeout: setTimeout(async () => {
            console.log(`Database timeout for document ${documentId}`)

            // Try to update the database
            try {
                await updateDatabase(documentId, updatedDocState, documentStates)
            } catch (error) {
                console.error(`Persist failed for document ${documentId}:`, error)
                socket.emit('document:delta:error', { code: 'PERSIST_FAILED' })
                return
            }

            socket.emit('document:delta:persisted', { message: 'Document changes persisted to database.' })

        }, DATABASE_TIMEOUT_MS),
        mlTimeout: setTimeout(async () => {
            console.log(`ML timeout for document ${documentId}`)

            // Trigger ML pipeline to redis.
            await redis.lpush('ml:queue:analyze', JSON.stringify({
                documentId,
                content: currentSentence,
                errors: errorsForSentence
            }))
            socket.emit('document:ml:triggered', { message: 'ML pipeline triggered.' })

        }, ML_TIMEOUT_MS)
    })

}

/**
 * Check if the delta is a character trigger. If it is, we need to trigger the ML pipeline.
 * @param delta - The delta to check
 * @returns True if the delta is a character trigger, false otherwise
 */
export function characterTriggered(delta: Delta): boolean {

    if (delta.type === 'insert' && delta.content.length >= 1) {

        if (delta.content === '\\') {
            return false
        }

        if (trigger1.includes(delta.content) || trigger2.includes(delta.content)) {
            return true
        }

        // Check for \end{...} cases
        if (/\\end\{[^}]+\}/.test(delta.content)) {
            return true
        }

    }
    return false
}

