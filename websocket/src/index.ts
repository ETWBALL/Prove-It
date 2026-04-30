import { createServer } from 'http'
import { Server } from 'socket.io'

type DeltaType = 'insert' | 'delete' | 'replace'

interface Delta {
    type: DeltaType
    startIndex: number
    endIndex: number
    content: string
    documentId: string
    validationLayer: 'LATEX_PARSER' | 'PROOF_GRAMMER' | 'COMPUTATION' | 'LOGIC_CHAIN'
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
    socket.on('document:join', (documentId: string) => {
        // Check if the document exists??? or assume they have the correct documentId???
        // Join the document with the given documentId
        socket.join(documentId)
        console.log(`User joined document ${documentId}`)
    })

    // Event 2: User leaves document
    socket.on('document:leave', (documentId: string) => {
        socket.leave(documentId)
        console.log(`User left document ${documentId}`)
    })


    // Event 3: User types (insert, delete, replace)

    // Listen for socket disconnection events
    socket.on('disconnect', () => {
        console.log('A user disconnected')
    })
})


// (4) start listening for connections on port 3001
httpServer.listen(3001, () => {
    console.log('WebSocket server is running on port 3001')
})


