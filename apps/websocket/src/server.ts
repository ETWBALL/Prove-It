import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import { authenticate, authorizeSocket} from './lib/serverHelpers'
import { Registry } from './lib/Registry'
import * as events from './events'
import { BroadcastToDocument, Delta } from "./lib/types";
import { GlobalLibraryRegistry } from './lib/globalLibraryRegistry'
import { ProofSettingState } from './lib/types/Document'
import { WorkspaceEntry } from './lib/types/Other'
import { SettingsOpened } from './events/Abort/SettingsOpened'



// (1) Create a new HTTP server provided by Node.js
const httpServer = createServer()

// (2) Create a new Socket.IO server
const io = new Server(httpServer, {
    pingInterval: 10000,  // send ping every 10 seconds
    pingTimeout: 5000,    // wait 5 seconds for pong before disconnecting
    maxHttpBufferSize: 10 * 1024 * 1024, // large document payloads on join/success
})


// (3) Set up Registry
const broadcastToDocument: BroadcastToDocument = (eventName, documentPublicId, payload) => {
    io.to(`document-${documentPublicId}`).emit(eventName, payload)
}
const isSocketAlive = (socketId: string) => io.sockets.sockets.has(socketId)
const disconnectSocket = (socketId: string) => io.sockets.sockets.get(socketId)?.disconnect(true)

const registry = new Registry(broadcastToDocument, isSocketAlive, disconnectSocket)

void (async () => {
    await GlobalLibraryRegistry.bootstrap()

    // (4) Set up Middleware for authentication
    authenticate(io)

    // (5) Listen for client connections
    io.on('connection', (clientSocket) => {
        console.log(`Client connected: ${clientSocket.id}`)

        // (1) OnJoin: Unprotected Gateway
        clientSocket.on('document:join', (documentId: string) => {events.Join(clientSocket, registry, documentId)})

        // (2) OnDelta: Protected. Users can send doc edits
        // (3) OnLeave: Protected. Users can leave 
        // (4) OnDisconnect: Protected. Handle user disconnections and clean up registry
        // (5) onAcceptSuggestion: Protected. Server needs to change doc state
        // (6) onRejectSuggestion: Protected. Server needs to change doc state

        // State changes
    
        // (7) onMathStatementAdded: Protected. Users can add definitions that impact doc state

        // (8) onProofTypeUpdate: Protected. Users can update the proof type of a question, which impacts doc state
        // (9) onLemmaAdded: Protected. Users can add lemmas that impact doc state
        // (10) onLemmaUpdated: Protected. Users can update lemmas that impact doc state
        // (11) onMathStatementUpdated: Protected. Users can update math statements that impact doc state

        // ABORT
        // (1) Proof settings opened
        clientSocket.on('document:settings:opened', authorizeSocket(clientSocket, registry, (socket: Socket, workspace: WorkspaceEntry) => {events.SettingsOpened(socket, workspace)}))
        // (2) OnQuestionDelta: Protected. Users can send question edits
        clientSocket.on('document:question:delta', authorizeSocket(clientSocket, registry, (socket: Socket, workspace: WorkspaceEntry, delta: Delta) => {events.QuestionDelta(socket, workspace, delta)}))
        

        // SERVER sends
        // (1) ProvableStatus: Send idle, analyizng, provabe, unprovable status to clients


    })
})()