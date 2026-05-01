import { Socket } from "socket.io";
import { DocumentState } from '@/lib/types'
import { updateDatabase } from '@/lib/helpers'


export async function onLeave(socket: Socket, documentStates: Map<string, DocumentState>, documentId: string, socketDocumentMap: Map<string, string>) {
    // Update the database with what you have
    const docState = documentStates.get(documentId)
    if (docState && docState.buffer.length > 0) {
        await updateDatabase(documentId, docState, documentStates) // persist document function
    }

    // Clean up
    documentStates.delete(documentId) 
    socketDocumentMap.delete(socket.id)

    // Send message
    socket.leave(documentId)
    console.log(`User left document ${documentId}`)
}
