import { createServer } from 'http'
import { Server } from 'socket.io'
import { prisma } from '@/lib/prisma'

// Type definitions here
type DeltaType = 'insert' | 'delete' | 'replace'

interface Delta {
    type: DeltaType
    startIndex: number
    endIndex: number
    content: string
    documentId: string
    validationLayer: 'LATEX_PARSER' | 'PROOF_GRAMMER' | 'COMPUTATION' | 'LOGIC_CHAIN'
    revision: number
}

interface DocumentState {
    content: string,
    contentId: string,
    revision: number, // The current revision (or at the end of the buffer array). Helps for syncing server side document and the client side document
    buffer: Delta[],
    errorCount: number
}

// Store all user's document states, deltas here (RAM)
const documentStates = new Map<string, DocumentState>() 

// Store socketID to documentID (useful for sudden disconnects)
const socketDocumentMap = new Map<string, string>() // socketId → documentId

function applyDelta(content: string, delta: Delta): string {
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

async function updateDatabase(documentPublicId: string, updatedDocState: DocumentState) {
    try {

        await prisma.$transaction(async (tx) => {
             // Update the document's lastEdited timestamp
            const updatedDocument = await tx.document.update({
                where: { publicId: documentPublicId },
                data: { lastEdited: new Date() }
            })

            // Update the document body with the new content
            const updatedDocumentBody = await tx.documentBody.upsert({
                where: { publicId: updatedDocState.contentId },
                update: { content: updatedDocState.content },
                create: {
                    content: updatedDocState.content,
                    privateDocumentId: updatedDocument.privateId
                }
            })

            // Add a new row to the proofAttempt table with the updated content and a reference to the document
            const proofAttempt = await tx.proofAttempt.create({
                data: {
                    privateDocumentId: updatedDocument.privateId,
                    content: updatedDocState.content,
                    versionName: `Snapshot at ${new Date().toISOString()}`,
                    errorCount: updatedDocument.numErrors
                }
            }) 
        })

        // If db succeeds: Update the document state in memory with the new content and clear the buffer
        documentStates.set(documentPublicId, {
                content: updatedDocState.content,
                contentId: updatedDocState.contentId,
                revision: updatedDocState.revision,
                buffer: [],
                errorCount: updatedDocState.errorCount
        })

    }catch(error){
        console.error(`Error updating database for document ${documentPublicId}:`, error)
    }
    
}

// (1) Create a new HTTP server provided by Node.js
const httpServer = createServer()

// (2) Create a new Socket.IO server
const io = new Server(httpServer, {
    pingInterval: 10000,  // send ping every 10 seconds
    pingTimeout: 5000,    // wait 5 seconds for pong before disconnecting
})

// (3) Listen for connections. Turn this connection into a socket
io.on('connection', (socket) => {
    console.log('A user connected with socket id:', socket.id);

    // Event 1: User opens document
    socket.on('document:join', async (documentId: string) => {
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


    })

    // Event 2: User types (insert, delete, replace)
    socket.on('document:delta', async (delta: Delta) => {
        console.log(`User typed in document ${delta.documentId}`)
    

        // Validate revision number for that specific documentID
        const docState = documentStates.get(delta.documentId)
        if (!docState) {
            console.error(`Document with id ${delta.documentId} not found in memory during type event.`)
            return
        }

        if (docState.revision + 1 !== delta.revision) {
            console.error(`Revision mismatch for document ${delta.documentId}. Expected ${docState.revision + 1}, got ${delta.revision}`)
            return
        }

        // Store the delta in the buffer and update the document state
        documentStates.set(delta.documentId, {
            content: applyDelta(docState.content, delta), // Call function
            contentId: docState.contentId,
            revision: delta.revision, // Increment revision
            buffer: [...docState.buffer, delta],
            errorCount: docState.errorCount
        })

        const updatedDocState = documentStates.get(delta.documentId)

        if (!updatedDocState) {
            console.error(`Document with id ${delta.documentId} not found in memory after applying delta.`)
            return
        }
        
        // Send acknowledgement back to the client that sent the delta
        socket.emit('document:delta:ack', { revision: delta.revision })

        // If buffer length exceeds threshold, persist to DB (proofAttempt and update old documentbody) and clear buffer
        if (updatedDocState.buffer.length >= 30) {
            await updateDatabase(delta.documentId, updatedDocState) // persist document function
            socket.emit('document:delta:persisted', { message: 'Document changes persisted to database.' })
        }

    })

    // Event 3: User leaves document
    socket.on('document:leave', async (documentId: string) => {
        // Update the database with what you have
        const docState = documentStates.get(documentId)
        if (docState && docState.buffer.length > 0) {
            await updateDatabase(documentId, docState) // persist document function
        }

        // Clean up
        documentStates.delete(documentId) 
        socketDocumentMap.delete(socket.id)

        // Send message
        socket.leave(documentId)
        console.log(`User left document ${documentId}`)
    })



    // Event 4: Listen for sudden disconnects
    socket.on('disconnect', async () => {
        // Get the documentId associated with this socket
        const documentId = socketDocumentMap.get(socket.id)
        if (!documentId) {
            console.error(`Document ID not found for socket ${socket.id}`)
            return
        }

         // Update the database with what you have
        const docState = documentStates.get(documentId)
        if (docState && docState.buffer.length > 0) {
            await updateDatabase(documentId, docState) // persist document function
        }

        // Clean up
        socketDocumentMap.delete(socket.id)
        documentStates.delete(documentId)

        console.log('A user disconnected')
    })

    // Event 5: Listen for save document event from client, persist to DB immediately
    // Event 6: Listen for lastCompiled to update document state in memory, persist to DB immediately (proofAttempt and update old documentbody)
    // Event 7: Listen for Hint being applied, error being ignored, suggestion being ignored/applied 
})


// (4) start listening for connections on port 3001
httpServer.listen(3001, () => {
    console.log('WebSocket server is running on port 3001')
})


