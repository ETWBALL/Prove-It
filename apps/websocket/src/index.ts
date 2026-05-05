import { verifyAccessToken } from '@prove-it/auth'

// Local Imports
import { createServer } from 'http'
import { Server } from 'socket.io'
import { Delta, DocumentState, Timers } from '../lib/types'
import { onDelta } from '../src/events/onDelta'
import { onJoin } from '../src/events/onJoin'
import { onLeave } from '../src/events/onLeave'
import { onDisconnect } from '../src/events/onDisconnect'



// Store all user's document states, deltas here (RAM)
const documentStates = new Map<string, DocumentState>() 
const timers = new Map<string, Timers>() // two timers per document

// Store socketID to active documentID (single active document per socket).
const socketDocumentMap = new Map<string, string>() // socketId -> documentId
const documentConnectionCounts = new Map<string, number>() // documentId -> active socket count

// (1) Create a new HTTP server provided by Node.js
const httpServer = createServer()

// (2) Create a new Socket.IO server
const io = new Server(httpServer, {
    pingInterval: 10000,  // send ping every 10 seconds
    pingTimeout: 5000,    // wait 5 seconds for pong before disconnecting
    maxHttpBufferSize: 10 * 1024 * 1024, // large document payloads on join/success
})

// (3) Middleware to verify access token
io.use(async (socket, next) => {
    try {
        // Check if their access token exists
        const accessToken = socket.handshake.auth.accessToken
        if (!accessToken) {
            return next(new Error('Unauthorized'))
        }

        // Verify the access token
        const { valid, expired, invalid, payload } = await verifyAccessToken(accessToken)

        if (expired){
            return next(new Error('Unauthorized: TOKEN_EXPIRED'))
        }

        if (!valid || invalid ) {
            return next(new Error('Unauthorized'))
        }

        socket.data.user = payload as { publicId: string, sessionPublicId: string }
        next()
    } catch (error) {
        console.error(error)
        return next(new Error('Unauthorized'))
    }
})

// (4) Listen for connections. Turn this connection into a socket
io.on('connection', (socket) => {
    console.log('A user connected with socket id:', socket.id);

    // Event 1: User opens document

    // socket.on('document:join', async (documentId: string) =>
    //     onJoin(socket, documentStates, documentId, socketDocumentMap, documentConnectionCounts)
    // )

    // Event 2: User types (insert, delete, replace) (IMPORTANT)

    // socket.on('document:delta', async (delta: Delta) => onDelta(socket, documentStates, delta, socketDocumentMap, timers))

    // Event 3: User leaves document

    // socket.on('document:leave', async (documentId: string) =>
    //     onLeave(socket, documentStates, documentId, socketDocumentMap, documentConnectionCounts, timers)
    // )

    // Event 4: Listen for sudden disconnects

    // socket.on('disconnect', async () =>
    //     onDisconnect(socket, documentStates, socketDocumentMap, documentConnectionCounts, timers)
    // )

    // Event 5: Listen for save document event from client, persist to DB immediately
    // Event 6: Listen for lastCompiled to update document state in memory, persist to DB immediately (proofAttempt and update old documentbody)
    // Event 7: Listen for Hint being applied, error being ignored, suggestion being ignored/applied 
})


// (5) start listening for connections on port 3001
httpServer.listen(3001, () => {
    console.log('WebSocket server is running on port 3001')
})


