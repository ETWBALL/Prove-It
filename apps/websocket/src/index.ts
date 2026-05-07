import { verifyAccessToken } from '@prove-it/auth'
import Redis from 'ioredis'

// Local Imports
import { createServer } from 'http'
import { Server } from 'socket.io'
import { Delta, DocumentState, Timers } from '../lib/types'
import { onDelta } from '../src/events/onDelta'
import { onJoin } from '../src/events/onJoin'
import { onLeave } from '../src/events/onLeave'
import { onDisconnect } from '../src/events/onDisconnect'

function parseCookieHeader(cookieHeader?: string): Record<string, string> {
    if (!cookieHeader) return {}
    return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
        const [rawKey, ...rest] = part.trim().split('=')
        if (!rawKey || rest.length === 0) return acc
        const rawValue = rest.join('=')
        try {
            acc[rawKey] = decodeURIComponent(rawValue)
        } catch {
            acc[rawKey] = rawValue
        }
        return acc
    }, {})
}



// Store all user's document states, deltas here (RAM)
const documentStates = new Map<string, DocumentState>() 
const timers = new Map<string, Timers>() // two timers per document

// Store socketID to active documentID (single active document per socket).
const socketDocumentMap = new Map<string, string>() // socketId -> documentId
const documentConnectionCounts = new Map<string, number>() // documentId -> active socket count


// Connect to Redis (subscriber for ML results -> websocket clients).
const redisHost = process.env.REDIS_HOST ?? 'localhost'
const redisPort = Number(process.env.REDIS_PORT ?? 6379)
const redisPassword = process.env.REDIS_PASSWORD || undefined

const redisSub = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
})

// (1) Create a new HTTP server provided by Node.js
const httpServer = createServer()

// (2) Create a new Socket.IO server
const io = new Server(httpServer, {
    pingInterval: 10000,  // send ping every 10 seconds
    pingTimeout: 5000,    // wait 5 seconds for pong before disconnecting
    maxHttpBufferSize: 10 * 1024 * 1024, // large document payloads on join/success
    cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        credentials: true,
    },
})

// (3) Middleware to verify access token
io.use(async (socket, next) => {
    try {
        const cookies = parseCookieHeader(socket.handshake.headers.cookie)
        const accessToken = cookies.accessToken
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

    socket.on('document:join', async (documentId: string) =>
        onJoin(socket, documentStates, documentId, socketDocumentMap, documentConnectionCounts)
    )

    // Event 2: User types (insert, delete, replace) (IMPORTANT)

    socket.on('document:delta', async (delta: Delta) => onDelta(socket, documentStates, delta, socketDocumentMap, timers))

    // Event 3: User leaves document

    socket.on('document:leave', async (documentId: string) =>
        onLeave(socket, documentStates, documentId, socketDocumentMap, documentConnectionCounts, timers)
    )

    // Event 4: Listen for sudden disconnects

    socket.on('disconnect', async () =>
        onDisconnect(socket, documentStates, socketDocumentMap, documentConnectionCounts, timers)
    )

    // Event 5: Listen for save document event from client, persist to DB immediately
    // Event 6: Listen for lastCompiled to update document state in memory, persist to DB immediately (proofAttempt and update old documentbody)
    // Event 7: Listen for Hint being applied, error being ignored, suggestion being ignored/applied 
})


// (5) Subscribe to Redis channel. This allows the WS server to listen for ML results.
redisSub.psubscribe('ml:result:*')
    .then(() => {
        console.log('Subscribed to Redis channel: ml:result:*')
    })
    .catch((err: unknown) => {
        console.error('Error subscribing to Redis channel:', err)
    })

redisSub.on('error', (err: Error) => {
    console.error('Redis subscriber connection error:', err)
})

redisSub.on('pmessage', (_pattern: string, channel: string, message: string) => {
    try {
        const channelParts = channel.split(':')
        const documentId = channelParts[2]
        if (!documentId) {
            console.warn(`Ignoring ML result from unexpected channel: ${channel}`)
            return
        }

        const result = JSON.parse(message)
        io.to(documentId).emit('document:ml:result', { documentId, result })
        console.log(`Forwarded ML result to document room ${documentId}.`)
    } catch (error) {
        console.error(`Failed to process Redis ML message for channel ${channel}:`, error)
    }
})

// (6) start listening for connections on port 3001
httpServer.listen(3001, () => {
    console.log('WebSocket server is running on port 3001')
})


