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
    revision: number, // The current revision (or at the end of the buffer array). Helps for syncing server side document and the client side document
    buffer: Delta[]
}

// Store all user's document states, deltas here (RAM)
const documentStates = new Map<string, DocumentState>() 


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
                revision: 0,
                buffer: []
            })
        }


    })

    // Event 2: User types (insert, delete, replace)
    socket.on('document:delta', (delta: Delta) => {
        io.to(delta.documentId).emit('document:delta', delta)
        console.log(`User typed in document ${delta.documentId}`)
    

        // Validate revision number
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
            revision: delta.revision, // Increment revision
            buffer: [...docState.buffer, delta]
        })

        const updatedDocState = documentStates.get(delta.documentId)

        if (!updatedDocState) {
            console.error(`Document with id ${delta.documentId} not found in memory after applying delta.`)
            return
        }

        // If buffer length exceeds threshold, persist to DB (proofAttempt and update old documentbody) and clear buffer
        if (updatedDocState.buffer.length >= 10) {
            persistDocumentState(delta.documentId) // persist document function
        }

        // Send acknowledgement back to the client that sent the delta
        socket.emit('document:delta:ack', { revision: delta.revision })
    })



    // Event 3: User leaves document
    socket.on('document:leave', (documentId: string) => {
        socket.leave(documentId)
        console.log(`User left document ${documentId}`)
    })



    // Event 4: Listen for sudden disconnects
    socket.on('disconnect', () => {
        console.log('A user disconnected')
    })
})


// (4) start listening for connections on port 3001
httpServer.listen(3001, () => {
    console.log('WebSocket server is running on port 3001')
})


