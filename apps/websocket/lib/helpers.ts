import { AuthenticatedSocket, Delta, DocumentState, ErrorState, Timers } from '../lib/types'
import Redis from 'ioredis'
import { prisma } from '@prove-it/db'
import { ErrorType, ValidationLayer } from '@prove-it/db/generated/prisma'

const DATABASE_TIMEOUT_MS = 60000 // 1 minute
const QUESTION_DEBOUNCE_MS = 60000 // align with autosave cadence until product defines a shorter UX debounce
const ML_TIMEOUT_MS = 35000 // 35 seconds

const MAX_DELTA_CONTENT_LENGTH = 50_000
const MAX_DOCUMENT_LENGTH = 1_000_000

const redisHost = process.env.REDIS_HOST ?? 'localhost'
const redisPort = Number(process.env.REDIS_PORT ?? 6379)
const redisPassword = process.env.REDIS_PASSWORD || undefined

const redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
})

redis.on('error', (err: Error) => {
    console.error('Redis publisher connection error:', err)
})


// Check for Standard Linguistic Triggers
const trigger1 = ['.', '?', '!', '\n', '\n\n', ':', ';']

// Check for Latex Triggers
const trigger2 = ['$$', '\]', '\therefore', '\qed', '\square']

// ``ValidationLayer`` is required on ``Error`` create. ML doesn't return it explicitly, so we derive it
// from ``errortype`` (LOGIC_CHAIN vs PROOF_GRAMMER). Keep this set in lockstep with the ML side
// ``apps/ml/src/schemas.py`` LOGIC_CHAIN_ERRORS dict — they MUST agree.
const LOGIC_CHAIN_ERROR_TYPES: ReadonlySet<ErrorType> = new Set<ErrorType>([
    'INCORRECT_NEGATION',
    'ASSUMING_THE_CONVERSE',
    'EQUIVOCATION',
    'FALSE_DICHOTOMY_IN_CASE_ANALYSIS',
    'UNJUSTIFIED_REVERSIBILITY',
    'MISAPPLYING_A_THEOREM',
    'MISAPPLYING_A_DEFINITION',
    'MISAPPLYING_A_LEMMA',
    'MISAPPLYING_A_PROPERTY',
    'MISAPPLYING_AN_AXIOM',
    'MISAPPLYING_A_COROLLARY',
    'MISAPPLYING_A_CONJECTURE',
    'MISAPPLYING_A_PROPOSITION',
    'AFFIRMING_THE_CONSEQUENT',
    'CIRCULAR_REASONING',
    'JUMPING_TO_CONCLUSIONS',
    'IMPROPER_GENERALIZATION',
    'IMPLICIT_ASSUMPTION',
    'CONTRADICTS_PREVIOUS_STATEMENT',
    'SCOPE_ERROR',
    'NON_SEQUITUR',
    'VACUOUS_PROOF_FALLACY',
    'EXISTENTIAL_INSTANTIATION_ERROR',
    'ASSUMING_THE_GOAL',
    'VARIABLE_SHADOWING',
    'PROOF_BY_EXAMPLE',
    'ILLEGAL_OPERATION',
    'VACUOUS_NEGATION',
    'STRUCTURE_ERROR',
])

export function deriveValidationLayer(errortype: ErrorType): ValidationLayer {
    return LOGIC_CHAIN_ERROR_TYPES.has(errortype) ? 'LOGIC_CHAIN' : 'PROOF_GRAMMER'
}

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


// Update the database with the current document hot state (body + proving statement).
// clearBodyBuffer / clearQuestionBuffer control which replay buffers reset after a successful txn.
export async function updateDatabase(
    documentPublicId: string,
    updatedDocState: DocumentState,
    documentStates: Map<string, DocumentState>,
    clearBodyBuffer: boolean = true,
    clearQuestionBuffer: boolean = false
) {
    try {

        const { persistedDocumentBody, persistedErrors } = await prisma.$transaction(async (tx) => {
             // Update the document's lastEdited timestamp
            const updatedDocument = await tx.document.update({
                where: { publicId: documentPublicId },
                data: { lastEdited: new Date() }
            })

            // DocumentBody is unique by privateDocumentId, so upsert by that key.
            const persistedDocumentBody = await tx.documentBody.upsert({
                where: { privateDocumentId: updatedDocument.privateId },
                update: { content: updatedDocState.content, provingStatement: updatedDocState.questionContent },
                create: {
                    provingStatement: updatedDocState.questionContent,
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

            // Errors:
            //   - existing errors (have ``publicId``) → ``update`` by publicId.
            //   - ML-produced errors that have never been persisted (``publicId === undefined``) →
            //     ``create`` and capture the freshly generated publicId so the in-memory state can
            //     reference the same DB row on the next save (no more orphan creates).
            // ``upsert`` is intentionally avoided here because Prisma requires a concrete ``where`` value;
            // we have no surrogate key to look up unpersisted errors by.
            const persistedErrors: ErrorState[] = await Promise.all(
                updatedDocState.errors.map(async (error): Promise<ErrorState> => {
                    const suggestionContent = error.suggestion?.suggestionContent ?? null
                    const startIndexSuggestion = error.suggestion?.startIndexSuggestion ?? 0
                    const endIndexSuggestion = error.suggestion?.endIndexSuggestion ?? 0

                    if (error.publicId) {
                        // Existing row: refresh anchors, lifecycle dates, message, and suggestion fields.
                        await tx.error.update({
                            where: { publicId: error.publicId },
                            data: {
                                startIndexError: error.startIndexError,
                                endIndexError: error.endIndexError,
                                errorMessage: error.errorMessage,
                                errortype: error.errortype,
                                layer: deriveValidationLayer(error.errortype),
                                problematicContent: error.problematicContent ?? null,
                                suggestionContent,
                                startIndexSuggestion,
                                endIndexSuggestion,
                                resolvedAt: error.resolvedAt,
                                dismissedAt: error.dismissedAt,
                            },
                        })
                        return error
                    }

                    // New row: Prisma generates publicId (cuid). We must supply every required column
                    // on the ``Error`` model — privateDocumentId, indices, errorMessage, errortype, layer,
                    // and suggestion indices (NOT null per schema).
                    const created = await tx.error.create({
                        data: {
                            startIndexError: error.startIndexError,
                            endIndexError: error.endIndexError,
                            errorMessage: error.errorMessage,
                            errortype: error.errortype,
                            layer: deriveValidationLayer(error.errortype),
                            problematicContent: error.problematicContent ?? null,
                            suggestionContent,
                            startIndexSuggestion,
                            endIndexSuggestion,
                            privateDocumentId: updatedDocument.privateId,
                            resolvedAt: error.resolvedAt,
                            dismissedAt: error.dismissedAt,
                        },
                    })
                    // Write the generated publicId back into the in-memory state so subsequent saves
                    // hit the ``update`` branch instead of creating duplicates.
                    return { ...error, publicId: created.publicId }
                }),
            )

            return { persistedDocumentBody, persistedErrors }
        })

        // If db succeeds: Update the document state in memory with the new content and clear the buffer.
        // ``errors`` is replaced with ``persistedErrors`` so newly-created rows now carry their publicId.
        documentStates.set(documentPublicId, {
                questionContent: updatedDocState.questionContent,
                questionRevision: updatedDocState.questionRevision,
                questionBuffer: clearQuestionBuffer ? [] : [...updatedDocState.questionBuffer],
                content: updatedDocState.content,
                contentId: persistedDocumentBody.publicId,
                revision: updatedDocState.revision,
                buffer: clearBodyBuffer ? [] : [...updatedDocState.buffer],
                errors: persistedErrors,
                coursePublicId: updatedDocState.coursePublicId,
                proofType: updatedDocState.proofType,
                selectedMathStatements: updatedDocState.selectedMathStatements,
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
        
        // Only update suggestion if error is not triggered AND suggestion actually exists.
        // ``ErrorState.suggestion`` is ``Suggestion | undefined`` (never ``null``) — use ``undefined`` for "no suggestion".
        const [newStart, newEnd] = !triggered && error.suggestion ? shiftRange(error.suggestion?.startIndexSuggestion ?? 0, error.suggestion?.endIndexSuggestion ?? 0, delta, error.resolvedAt, 'suggestion', error.suggestion?.suggestionContent ?? '') : [0, 0]
        if (!triggered) {
            updatedError.suggestion = error.suggestion ? {
                    suggestionContent: error.suggestion.suggestionContent,
                    startIndexSuggestion: newStart, // For simplicity, we will shift the suggestion indices the same way as the error indices. This is not 100% accurate but it is a reasonable approximation. We can improve this later if needed.
                    endIndexSuggestion: newEnd
                } : undefined
        } else {
            // Error is being re-evaluated by ML — suggestion is stale either way. Keep the message but zero the anchors.
            updatedError.suggestion = error.suggestion ? {
                suggestionContent: error.suggestion.suggestionContent,
                startIndexSuggestion: 0, // stale
                endIndexSuggestion: 0 // stale
            } : undefined
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

/** Bounds of the sentence containing the edit cursor (used for ML payloads). */
export function getCurrentSentenceBounds(
    content: string,
    startIndex: number,
    endIndex: number,
): { sentence: string; sentenceStart: number; sentenceEnd: number } {
    let sentenceStart = 0
    for (let i = startIndex; i >= 0; i--) {
        if (trigger1.includes(content[i]) || trigger2.includes(content[i])) {
            sentenceStart = i + 1
            break
        }
    }

    let sentenceEnd = content.length
    for (let i = endIndex; i < content.length; i++) {
        if (trigger1.includes(content[i]) || trigger2.includes(content[i])) {
            sentenceEnd = i
            break
        }
    }

    return {
        sentence: content.slice(sentenceStart, sentenceEnd),
        sentenceStart,
        sentenceEnd,
    }
}

export function getCurrentSentence(content: string, startIndex: number, endIndex: number): string {
    return getCurrentSentenceBounds(content, startIndex, endIndex).sentence
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

    // Sentence under edit + proof prefix up to it (matches ML ``AnalyzeBody`` for body_analysis).
    const { sentence: currentSentence, sentenceStart } = getCurrentSentenceBounds(
        updatedDocState.content,
        latestDelta.startIndex,
        latestDelta.endIndex,
    )
    const proofBodyUpToSentence = updatedDocState.content.slice(0, sentenceStart)

    // Get the errors that are associated with the current sentence(s)
    const errorsForSentence = getErrorsForSentence(updatedDocState.errors, currentSentence)

    // Set new timers
    timers.set(documentId, {
        ...existingTimers,
        databaseTimeout: setTimeout(async () => {
            console.log(`Autosaving document ${documentId}`)

            // Try to update the database
            try {
                await updateDatabase(
                    documentId,
                    updatedDocState,
                    documentStates,
                    true,
                    updatedDocState.questionBuffer.length > 0
                )
            } catch (error) {
                console.error(`Autosaving failed for document ${documentId}:`, error)
                socket.emit('document:delta:error', { code: 'PERSIST_FAILED' })
                return
            }

            socket.emit('document:delta:persisted', { message: 'Document changes persisted to database.' })

        }, DATABASE_TIMEOUT_MS),
        mlTimeout: setTimeout(async () => {
            console.log(`ML Triggered: Body analysis till current sentence for document ${documentId}`)

            // Trigger ML pipeline to redis.
            await redis.lpush('ml:queue:analyze', JSON.stringify({
                taskType: 'body_analysis',
                documentId: documentId,
                payload: {
                    mathStatements: updatedDocState.selectedMathStatements ?? [],
                    provingStatement: updatedDocState.questionContent,
                    content: proofBodyUpToSentence,
                    currentSentence: currentSentence,
                    fullProofContent: updatedDocState.content,
                    currentSentenceErrors: errorsForSentence,
                    allDocumentErrors: updatedDocState.errors
                }

            }))
            socket.emit('document:ml:triggered', { message: 'ML triggered for body analysis.' })
            
        }, ML_TIMEOUT_MS)
    })

}


export function setUpQuestionTimer(documentId: string, timers: Map<string, Timers>, documentStates: Map<string, DocumentState>, socket: AuthenticatedSocket) {
    const existingTimers = timers.get(documentId)

    // Clear prior question autosave timer; database / ML timeouts are owned by document:delta.
    if (existingTimers) {
        if (existingTimers.questionTimeout) clearTimeout(existingTimers.questionTimeout)
    }

    // Snapshot only to validate presence; callback re-reads map for freshest state.
    const warmState = documentStates.get(documentId)

    if (!warmState) {
        console.error(`Document state not found for document ${documentId}`)
        socket.emit('document:qDelta:error', { code: 'DOCUMENT_STATE_MISSING' })
        return
    }

    const latestDelta = warmState.questionBuffer.at(-1)

    if (!latestDelta) {
        console.error(`No question delta found for document ${documentId}`)
        socket.emit('document:qDelta:error', { code: 'NO_QUESTION_DELTA_FOUND' })
        return
    }

    timers.set(documentId, {
        ...existingTimers,
        questionTimeout: setTimeout(async () => {
            console.log(`Autosaving question content for document ${documentId}`)
            const latest = documentStates.get(documentId)

            // Room empty or raced away document state — nothing to save.
            if (!latest) {
                return
            }

            try {
                // Persist body snapshot + proving text; flush only proving replay buffer here.
                await updateDatabase(documentId, latest, documentStates, false, true)
            } catch (error) {
                console.error(`Autosaving question content failed for document ${documentId}:`, error)
                socket.emit('document:qDelta:error', { code: 'PERSIST_QUESTION_FAILED' })
                return
            }

            socket.emit('document:qDelta:persisted', {
                message: 'Document proving statement persisted to database.',
            })
        }, QUESTION_DEBOUNCE_MS),
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

