import type { Server } from 'socket.io'
import { DocumentState, ErrorState, MathStatements, Suggestion } from '../../lib/types'


// Shape of what comes back from the ML service via Redis pub/sub.
//
// The ML service publishes the *raw* ``Response1`` or ``Response2`` model dump to channel
// ``ml:result:{documentId}`` — there is NO ``{ type, data }`` envelope (we removed that). We discriminate
// the two response shapes by which field is present:
//   - ``Response1`` → math-statement assist (proofType + add/remove math statements).
//   - ``Response2`` → detected errors for the current sentence / proof body.
type MLAddedMathStatement = {
    publicId?: string
    type?: MathStatements['type']
    name?: string
    content?: string
    hint?: string
}
type MLRemovedMathStatement = { publicId?: string; name?: string }
type MLDetectedError = {
    startIndexError: number
    endIndexError: number
    problematicContent?: string
    errorMessage: string
    errortype: ErrorState['errortype']
    suggestedFix?: Suggestion | null
}
type MLResult =
    | {
          documentId: string
          proofType?: MathStatements extends never ? never : DocumentState['proofType']
          addMathStatements?: MLAddedMathStatement[]
          removeMathStatements?: MLRemovedMathStatement[]
      }
    | {
          documentId: string
          errors: MLDetectedError[]
      }


/**
 * Process an ML result and broadcast it to the document room.
 *
 * Called from the server-level Redis ``pmessage`` handler (see ``src/index.ts``). We use ``io`` here
 * (not a single socket) so every client in the room — and any future co-editors — get the same payload.
 * The per-socket ``socket.on('document:ml:result', ...)`` was removed: it had a signature mismatch with
 * the room broadcast and would have re-mutated ``documentStates`` once per connected socket.
 */
export async function onMLResult(
    io: Server,
    documentStates: Map<string, DocumentState>,
    documentId: string,
    result: MLResult,
    library: Map<string, MathStatements[]>,
) {
    const currentState = documentStates.get(documentId)
    if (!currentState) {
        // Document was closed / evicted between the ML enqueue and now. Nothing to merge or emit.
        return
    }

    // (1) Math-statement assist (Response1). Detect by presence of ``addMathStatements`` /
    //     ``removeMathStatements`` — ``errors`` will be absent on this branch.
    if ('addMathStatements' in result || 'removeMathStatements' in result) {
        let newMathStatements: MathStatements[] = [...(currentState.selectedMathStatements ?? [])]
        const courseStatements = library.get(currentState.coursePublicId ?? '') ?? []
        // Index the course library by publicId once so we can resolve textbook/orderIndex per statement,
        // not just from "the first one in the course" (which was a bug — every added statement got the same metadata).
        const libraryByPublicId = new Map<string, MathStatements>(
            courseStatements.map(ms => [ms.publicId, ms]),
        )

        // Remove first so a single round-trip can both swap out an old statement and add a new one.
        if (result.removeMathStatements) {
            for (const ms of result.removeMathStatements) {
                newMathStatements = newMathStatements.filter(existing =>
                    existing.publicId !== ms.publicId && existing.name !== ms.name,
                )
            }
        }

        if (result.addMathStatements) {
            for (const ms of result.addMathStatements) {
                // Skip if already selected (by publicId or name).
                if (newMathStatements.some(existing =>
                    (ms.publicId && existing.publicId === ms.publicId) ||
                    (ms.name && existing.name === ms.name),
                )) {
                    continue
                }

                // Prefer library row (canonical content + textbook + orderIndex). Fall back to the
                // ML-supplied fields for statements not in the master library (rare; usually means a
                // model-invented title — we still surface it so the user can review).
                const fromLibrary = ms.publicId ? libraryByPublicId.get(ms.publicId) : undefined
                newMathStatements.push({
                    publicId: fromLibrary?.publicId ?? ms.publicId ?? '',
                    type: fromLibrary?.type ?? ms.type ?? 'DEFINITION',
                    name: fromLibrary?.name ?? ms.name ?? '',
                    content: fromLibrary?.content ?? ms.content ?? '',
                    hint: ms.hint ?? fromLibrary?.hint ?? '',
                    textbook: fromLibrary?.textbook ?? '',
                    orderIndex: fromLibrary?.orderIndex ?? 0,
                })
            }
        }

        // Persist in RAM. Note: the documentMathStatements join table is NOT touched here — it gets
        // rewritten by the web app when the user accepts the suggestion. Doing it here would race with
        // user edits in the math-statement panel.
        documentStates.set(documentId, {
            ...currentState,
            selectedMathStatements: newMathStatements,
            proofType: ('proofType' in result && result.proofType) ? result.proofType : currentState.proofType,
        })
        console.log(`ML Result: Math statements updated for document ${documentId}`)   
        io.to(documentId).emit('document:ml:result', {
            documentId,
            mathStatements: newMathStatements,
        })
        return
    }

    // (2) Detected errors (Response2). New ML errors get ``publicId: undefined`` — the next
    //     ``updateDatabase`` flush creates the row and writes the generated publicId back.
    if ('errors' in result && Array.isArray(result.errors)) {
        const newErrors: ErrorState[] = [...(currentState.errors ?? [])]

        for (const error of result.errors) {
            // Coerce DB/JSON ``null`` for missing suggestion to ``undefined`` (the ErrorState contract).
            const suggestion: Suggestion | undefined = error.suggestedFix
                ? {
                      suggestionContent: error.suggestedFix.suggestionContent,
                      startIndexSuggestion: error.suggestedFix.startIndexSuggestion,
                      endIndexSuggestion: error.suggestedFix.endIndexSuggestion,
                  }
                : undefined

            newErrors.push({
                publicId: undefined, // assigned by Prisma on next updateDatabase flush
                startIndexError: error.startIndexError,
                endIndexError: error.endIndexError,
                errorMessage: error.errorMessage,
                errortype: error.errortype,
                suggestion,
                resolvedAt: null,
                dismissedAt: null,
                problematicContent: error.problematicContent,
                MLTriggered: false,
            })
        }

        documentStates.set(documentId, {
            ...currentState,
            errors: newErrors,
        })
        console.log(`ML Result: Errors updated for document ${documentId}`)
        io.to(documentId).emit('document:ml:result', {
            documentId,
            errors: newErrors,
        })
        return
    }

    // Unknown shape — log once so we notice contract drift between ML and websocket.
    console.warn(`onMLResult: unrecognized payload shape for document ${documentId}`, Object.keys(result))
}
