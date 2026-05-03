import { DocumentState, ErrorState, Suggestion, AuthenticatedSocket} from '../../lib/types'
import { prisma } from '@prove-it/db'


export async function onJoin(socket: AuthenticatedSocket, documentStates: Map<string, DocumentState>, documentId: string, socketDocumentMap: Map<string, string>) {
    const userPublicId = socket.data.user?.publicId
    if (!userPublicId) {
        socket.emit('document:join:error', { code: 'UNAUTHORIZED' })
        return
    }

    // Enforce ownership before joining the room.
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

    if (!document) {
        socket.emit('document:join:error', { code: 'FORBIDDEN' })
        return
    }

    // User is authorized, now join.
    socket.join(documentId)
    console.log(`User joined document ${documentId}`)

    // Check if the document is in the map. If not, hydrate from DB.
    if (!documentStates.has(documentId)) {
        const errorStates: ErrorState[] = document.errors.map(error => {
            // Create the suggestion state
            const suggestion: Suggestion | null = error && error.suggestionContent ? {
                suggestionContent: error.suggestionContent,
                startIndexSuggestion: error.startIndexSuggestion,
                endIndexSuggestion: error.endIndexSuggestion
            } : null

            // Set up the error state
            return {
                publicId: error.publicId,
                startIndexError: error.startIndexError,
                endIndexError: error.endIndexError,
                errorContent: error.errorContent,
                suggestion: suggestion,
                resolvedAt: error.resolvedAt,
                dismissedAt: error.dismissedAt,
                problematicContent: document.documentBody?.content.slice(error.startIndexError, error.endIndexError) ?? '', // Extract the problematic content from the document body using the error's start and end indices
                MLTriggered: false
            }
        })
           
        documentStates.set(documentId, {
            content: document.documentBody?.content as string ?? '',
            contentId: document.documentBody?.publicId as string ?? '',
            revision: 0,
            buffer: [],
            errors: errorStates,
        })
    }
    socketDocumentMap.set(socket.id, documentId)
}