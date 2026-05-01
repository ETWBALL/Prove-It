import { Socket } from "socket.io";
import { DocumentState } from '@/lib/types'
import { prisma } from '@/lib/prisma'


export async function onJoin(socket: Socket, documentStates: Map<string, DocumentState>, documentId: string, socketDocumentMap: Map<string, string>) {
    // Join the document with the given documentId
    socket.join(documentId)
    console.log(`User joined document ${documentId}`)

    // Check if the document is in the map. If not, fetch from DB
    if (!documentStates.has(documentId)) {
        const document = await prisma.document.findUnique({
            where: { publicId: documentId },
            include: { documentBody: true}
        })

        if (!document) {
            console.error(`Document with id ${documentId} not found.`)
            return
        }

        documentStates.set(documentId, {
            content: document.documentBody?.content as string ?? '',
            contentId: document.documentBody?.publicId as string ?? '',
            revision: 0,
            buffer: [],
            errorCount: document.numErrors
        })
    }
    socketDocumentMap.set(socket.id, documentId)
}