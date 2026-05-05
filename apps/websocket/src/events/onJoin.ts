import { DocumentState, ErrorState, Suggestion, AuthenticatedSocket} from '../../lib/types'
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
            const other = socket.nsp.sockets.get(otherId) as AuthenticatedSocket | undefined
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
            other?.disconnect(true) ?? null
        }

        // Check if the user is already in this document (idempotent join — still acknowledge)
        const currentDocumentId = socketDocumentMap.get(socket.id)
        if (currentDocumentId === documentId) {
            const state = documentStates.get(documentId)
            socket.emit('document:join:success', {
                documentId,
                content: state?.content ?? '',
                revision: state?.revision ?? 0,
                buffer: state?.buffer ?? [],
                errors: state?.errors ?? [],
            })
            return
        }
        // Check if the user is already in a different document
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
                user: { is: { publicId: userPublicId } },
            },
            include: { 
                documentBody: true,
                errors: {
                    where: {
                        resolvedAt: null,
                        dismissedAt: null
                    }
                }
            }
        })

        // Check if the document exists
        if (!document) {
            socket.emit('document:join:error', { code: 'FORBIDDEN' })
            return
        }

        // Join the document
        socket.join(documentId)
        console.log(`User joined document ${documentId}`)

        // Check if the document state exists
        if (!documentStates.has(documentId)) {
            const errorStates: ErrorState[] = document.errors.map(error => {
                const suggestion: Suggestion | null = error && error.suggestionContent ? {
                    suggestionContent: error.suggestionContent,
                    startIndexSuggestion: error.startIndexSuggestion,
                    endIndexSuggestion: error.endIndexSuggestion
                } : null

                return {
                    publicId: error.publicId,
                    startIndexError: error.startIndexError,
                    endIndexError: error.endIndexError,
                    errorContent: error.errorContent,
                    suggestion: suggestion,
                    resolvedAt: error.resolvedAt,
                    dismissedAt: error.dismissedAt,
                    problematicContent: document.documentBody?.content.slice(error.startIndexError, error.endIndexError) ?? '',
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
            })
        }

        // Set the socket document map and document connection counts
        socketDocumentMap.set(socket.id, documentId)
        documentConnectionCounts.set(documentId, (documentConnectionCounts.get(documentId) ?? 0) + 1)

        // Emit success back to client
        socket.emit('document:join:success', { 
            documentId: documentId,
            content: document.documentBody?.content as string ?? '',
            revision: documentStates.get(documentId)?.revision ?? 0,
            buffer: documentStates.get(documentId)?.buffer ?? [],
            errors: documentStates.get(documentId)?.errors ?? [],
        })

    } catch (error) {
        console.error(`Unhandled join error for document ${documentId}:`, error)
        socket.emit('document:join:error', { code: 'INTERNAL_ERROR' })
    }
}