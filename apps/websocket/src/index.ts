import { createServer } from 'http'
import { Server } from 'socket.io'
import { Delta, DocumentState } from '../lib/types'
import { onDelta } from '../src/events/onDelta'
import { onJoin } from '../src/events/onJoin'
import { onLeave } from '../src/events/onLeave'
import { onDisconnect } from '../src/events/onDisconnect'


// Store all user's document states, deltas here (RAM)
const documentStates = new Map<string, DocumentState>() 

// Store socketID to documentID (useful for sudden disconnects)
const socketDocumentMap = new Map<string, string>() // socketId → documentId

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
    socket.on('document:join', async (documentId: string) => onJoin(socket, documentStates, documentId, socketDocumentMap))

    // Event 2: User types (insert, delete, replace) (IMPORTANT)
    socket.on('document:delta', async (delta: Delta) => onDelta(socket, documentStates, delta))

    // Event 3: User leaves document
    socket.on('document:leave', async (documentId: string) => onLeave(socket, documentStates, documentId, socketDocumentMap))

    // Event 4: Listen for sudden disconnects
    socket.on('disconnect', async () => onDisconnect(socket, documentStates, socketDocumentMap))

    // Event 5: Listen for save document event from client, persist to DB immediately
    // Event 6: Listen for lastCompiled to update document state in memory, persist to DB immediately (proofAttempt and update old documentbody)
    // Event 7: Listen for Hint being applied, error being ignored, suggestion being ignored/applied 
})


// (4) start listening for connections on port 3001
httpServer.listen(3001, () => {
    console.log('WebSocket server is running on port 3001')
})


