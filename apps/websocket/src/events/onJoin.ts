import { DocumentState, ErrorState, Suggestion, AuthenticatedSocket, MathStatements} from '../../lib/types'
import { prisma } from '@prove-it/db'


export async function onJoin(
    socket: AuthenticatedSocket,
    documentStates: Map<string, DocumentState>,
    documentId: string,
    socketDocumentMap: Map<string, string>,
    documentConnectionCounts: Map<string, number>
) {
    try {

        // Check if the user is authorized to join the document
        const userPublicId = socket.data.user?.publicId
        if (!userPublicId) {
            socket.emit('document:join:error', { code: 'UNAUTHORIZED' })
            return
        }

        // Same user reconnected (new tab / reran test client): drop their older socket so join can proceed.
        // Otherwise DOCUMENT_LOCKED stays until the old TCP session fully disconnects.
        for (const [otherId, mappedDocId] of [...socketDocumentMap.entries()]) {

            // Skip if the other socket is not mapped to the same document or is the same socket
            if (mappedDocId !== documentId || otherId === socket.id) continue

            // Get the other socket. Could be underined
            const other = socket.nsp.sockets.get(otherId) as AuthenticatedSocket | undefined

            // Stale map entry: socket no longer exists in namespace map. Clean it up now.
            if (!other) {
                socketDocumentMap.delete(otherId)
                const prevCount = documentConnectionCounts.get(documentId) ?? 1
                const nextCount = Math.max(0, prevCount - 1)
                if (nextCount === 0) {
                    documentConnectionCounts.delete(documentId)
                } else {
                    documentConnectionCounts.set(documentId, nextCount)
                }
                continue
            }

            if (other?.data?.user?.publicId !== userPublicId) continue

            // Assume at this point that its the same user, on the same document, not the current socket.
            socketDocumentMap.delete(otherId)
            const prevCount = documentConnectionCounts.get(documentId) ?? 1
            const nextCount = Math.max(0, prevCount - 1)
            if (nextCount === 0) {
                documentConnectionCounts.delete(documentId)
            } else {
                documentConnectionCounts.set(documentId, nextCount)
            }
            // Disconnect the other socket
            other.disconnect(true)
    
        }

        // Check if the user's tab already opened this document (idempotent join — still acknowledge)
        const currentDocumentId = socketDocumentMap.get(socket.id)
        if (currentDocumentId === documentId) {
            const state = documentStates.get(documentId)
            socket.emit('document:join:success', {
                documentId,
                content: state?.content ?? '',
                revision: state?.revision ?? 0,
                buffer: state?.buffer ?? [],
                errors: state?.errors ?? [],
                questionContent: state?.questionContent ?? '',
                questionRevision: state?.questionRevision ?? 0,
                questionBuffer: state?.questionBuffer ?? [],
                mathStatements: state?.selectedMathStatements ?? [],
                proofType: state?.proofType ?? null,
                coursePublicId: state?.coursePublicId ?? null,
            })
            return
        }

        // Check if the user's tab is already in a different document
        if (currentDocumentId && currentDocumentId !== documentId) {
            socket.emit('document:join:error', { code: 'ALREADY_IN_DOCUMENT' })
            return
        }

        // Check if another user is already in the document
        const otherSocketOnDocument = Array.from(socketDocumentMap.entries()).some(
            ([socketId, mappedDocumentId]) => socketId !== socket.id && mappedDocumentId === documentId
        )
        if (otherSocketOnDocument) {
            console.warn(
                `[onJoin] DOCUMENT_LOCKED doc=${documentId} — another user still has this document open.`
            )
            socket.emit('document:join:error', {
                code: 'DOCUMENT_LOCKED',
                message:
                    'Only one active session per document (different user). Close the other session or use another document.',
            })
            return
        }
        socket.emit('document:join:processing', { documentId: documentId })

        // Find the document

        const document = await prisma.document.findFirst({
            where: {
                publicId: documentId,
                deletedAt: null,
                user: { is: { publicId: userPublicId } }, // This verifies if they actually own this document
            },
            include: { 
                documentBody: true, 
                course: true,
                errors: {
                    where: {
                        resolvedAt: null,
                        dismissedAt: null
                    }
                },
                documentMathStatements: {
                    include: {
                        mathstatement: true
                    }
                },
            }
        })

        // Check if the document exists
        if (!document) {
            socket.emit('document:join:error', { code: 'FORBIDDEN' })
            return
        }

        // Join the document
        socket.join(documentId)

        // set up the math statements
        const selectedMathStatements: MathStatements[] = document.documentMathStatements.map(row => ({
            publicId: row.mathstatement.publicId,
            type: row.mathstatement.type,
            name: row.mathstatement.name,
            content: row.mathstatement.content,
            hint: row.mathstatement.hint ?? '',
            textbook: row.mathstatement.textbook,
            orderIndex: row.mathstatement.orderIndex,
        }));
        

        // Check if the document state exists
        if (!documentStates.has(documentId)) {
            const errorStates: ErrorState[] = document.errors.map(error => {
                // ``ErrorState.suggestion`` uses ``undefined`` (not null) for "no suggestion"; DB-null is coerced here.
                const suggestion: Suggestion | undefined = error.suggestionContent ? {
                    suggestionContent: error.suggestionContent,
                    startIndexSuggestion: error.startIndexSuggestion,
                    endIndexSuggestion: error.endIndexSuggestion
                } : undefined

                return {
                    publicId: error.publicId,
                    startIndexError: error.startIndexError,
                    endIndexError: error.endIndexError,
                    // Renamed Prisma field: ``errorContent`` column is now exposed as ``errorMessage`` via @map.
                    errorMessage: error.errorMessage,
                    errortype: error.errortype,
                    suggestion,
                    resolvedAt: error.resolvedAt,
                    dismissedAt: error.dismissedAt,
                    // Prefer the stored snippet; fall back to slicing the body for legacy rows (problematicContent
                    // was added in migration 20260513170000_add_problematic_content_to_error and is null for older errors).
                    problematicContent:
                        error.problematicContent
                        ?? document.documentBody?.content.slice(error.startIndexError, error.endIndexError)
                        ?? '',
                    MLTriggered: false
                }
            })
            
            // Set the document state
            documentStates.set(documentId, {
                content: document.documentBody?.content as string ?? '',
                contentId: document.documentBody?.publicId as string ?? '',
                revision: 0,
                buffer: [],
                errors: errorStates,
                questionContent: document.documentBody?.provingStatement ?? '',
                questionRevision: 0,
                questionBuffer: [],
                coursePublicId: document.course?.publicId ?? null,
                proofType: document.proofType ?? null,
                selectedMathStatements: selectedMathStatements,
            })
        }

        // Set the socket document map and document connection counts
        socketDocumentMap.set(socket.id, documentId)
        documentConnectionCounts.set(documentId, (documentConnectionCounts.get(documentId) ?? 0) + 1)

        const live = documentStates.get(documentId)

        // Emit success back to client
        socket.emit('document:join:success', { 
            documentId: documentId,
            content: document.documentBody?.content as string ?? '',
            revision: live?.revision ?? 0,
            buffer: live?.buffer ?? [],
            errors: live?.errors ?? [],
            questionContent: live?.questionContent ?? document.documentBody?.provingStatement ?? '',
            questionRevision: live?.questionRevision ?? 0,
            questionBuffer: live?.questionBuffer ?? [],
            mathStatements: live?.selectedMathStatements ?? selectedMathStatements,
            proofType: live?.proofType ?? document.proofType ?? null,
            coursePublicId: live?.coursePublicId ?? document.course?.publicId ?? null,
        })

        console.log(`User joined document ${documentId} successfully!`)


    } catch (error) {
        console.error(`Unhandled join error for document ${documentId}:`, error)
        socket.emit('document:join:error', { code: 'INTERNAL_ERROR' })
    }
}