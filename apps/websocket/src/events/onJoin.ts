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

        // Check if the user is already in a document
        const currentDocumentId = socketDocumentMap.get(socket.id)
        if (currentDocumentId === documentId) {
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
            socket.emit('document:join:error', { code: 'DOCUMENT_LOCKED' })
            return
        }

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
    } catch (error) {
        console.error(`Unhandled join error for document ${documentId}:`, error)
        socket.emit('document:join:error', { code: 'INTERNAL_ERROR' })
    }
}