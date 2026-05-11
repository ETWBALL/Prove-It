import { verifyAccessToken } from '@prove-it/auth'
import Redis from 'ioredis'

// Local Imports
import { createServer } from 'http'
import { Server } from 'socket.io'
import { Delta, DocumentState, Timers, MathStatements} from '../lib/types'
import { onDelta } from '../src/events/onDelta'
import { onJoin } from '../src/events/onJoin'
import { onLeave } from '../src/events/onLeave'
import { onDisconnect } from '../src/events/onDisconnect'
import { onQuestionDelta } from '../src/events/onQuestionDelta'
import { onQuestionMLTrigger } from '../src/events/mlTrigger:Question'
import { prisma } from '@prove-it/db'

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
const timers = new Map<string, Timers>() // optional per-doc: body autosave, ML, proving-statement autosave

// Store socketID to active documentID (single active document per socket).
const socketDocumentMap = new Map<string, string>() // socketId -> documentId
const documentConnectionCounts = new Map<string, number>() // documentId -> active socket count
const library = new Map<string, MathStatements[]>() // Store <course_publicId, definitions> in here

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

    // Event 4: Socket disconnect (browser close, network drop, etc.)
    socket.on('disconnect', async () =>
        onDisconnect(socket, documentStates, socketDocumentMap, documentConnectionCounts, timers)
    )

    // Event 5: Proving statement edits (document:qDelta) — same Delta shape, separate stream from body
    socket.on('document:qDelta', async (qDelta: Delta) =>
        onQuestionDelta(socket, documentStates, qDelta, socketDocumentMap, timers)
    )

    // Event 6: ML Trigger: Find necessary definitions for the proof statement
    socket.on('document:question:ml:trigger', async (documentID: string) =>
        onQuestionMLTrigger(socket, documentStates, documentID, socketDocumentMap, library)
    )

    // Event 7: Listen for Hint being applied, error being ignored, suggestion being ignored/applied 
    // Event 8: Listen for ML result from Redis, update document state in memory and emit to client
    // Event 9: 
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

// (6) Load the library from the database into memory

async function loadLibrary() {

    try {
        const courses = await prisma.course.findMany({
            select: {
                publicId: true,
                mathStatements: {
                    select: {
                        publicId: true,
                        type: true,
                        name: true,
                        content: true,
                        textbook: true,
                        orderIndex: true,
                    },
                    orderBy: {
                        orderIndex: 'asc',
                    },
                },
            },
        })

        library.clear()
        for (const course of courses) {
            const statements: MathStatements[] = course.mathStatements.map((mathStatement) => ({
                publicId: mathStatement.publicId,
                type: mathStatement.type,
                name: mathStatement.name,
                content: mathStatement.content ?? '',
                textbook: mathStatement.textbook ?? 'Unknown Textbook',
                orderIndex: mathStatement.orderIndex,
            }))
            library.set(course.publicId, statements)
        }
        console.log(`Library loaded into memory (${library.size} courses)`)

    } catch (error) {
        console.error('Failed to load library:', error)
    }
}


// (7) start listening for connections on port 3001
loadLibrary().then(() => {
    httpServer.listen(3001, () => {
        console.log('WebSocket server is running on port 3001')
    })
})


