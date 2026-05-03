import { Socket } from "socket.io";
import { DocumentState, ErrorState, Suggestion } from '@/lib/types'
import { prisma } from '@/lib/prisma'


export async function onJoin(socket: Socket, documentStates: Map<string, DocumentState>, documentId: string, socketDocumentMap: Map<string, string>) {
    // Join the document with the given documentId
    socket.join(documentId)
    console.log(`User joined document ${documentId}`)

    // Check if the document is in the map. If not, fetch from DB
    if (!documentStates.has(documentId)) {
        const document = await prisma.document.findUnique({
            where: { publicId: documentId },
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
            console.error(`Document with id ${documentId} not found.`)
            return
        }

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