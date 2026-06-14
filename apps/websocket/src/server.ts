import { createServer } from 'http'
import { Server } from 'socket.io'
import type { AuthenticatedSocket, BroadcastToDocument } from './lib/types'
import { normalizeWireDelta, type WireDeltaPayload } from './lib/normalizeWireDelta'
import { authenticate, authorizeSocket} from './lib/authHelpers'
import { Registry } from './lib/Registry'
import * as events from './events'
import { GlobalLibraryRegistry } from './lib/globalLibraryRegistry'



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

        // (1) OnJoin: Unprotected Gateway. `void` the floating promise; Join contains its own errors.
        clientSocket.on('document:join', (documentId: string) => {void events.Join(clientSocket, registry, documentId)})

        // (2) OnDelta: Protected. Users can send doc edits
        // (3) OnLeave: Protected. Users can leave 
        // (5) onAcceptSuggestion: Protected. Server needs to change doc state
        // (6) onRejectSuggestion: Protected. Server needs to change doc state



        //* (12) error is resolved or dismissed
        

        //* (1) OnQuestionDelta (ABORT): Protected. Users can send question edits 
        clientSocket.on('document:question:delta', authorizeSocket(clientSocket as AuthenticatedSocket, registry, (socket, workspace, payload: WireDeltaPayload) => {
            events.QuestionDelta(socket, workspace, normalizeWireDelta(payload, 'question'));
        }, { errorEvent: 'document:question:delta:error' }))
        // (2) OnDisconnect (ABORT): Native Socket.IO drop (tab close, network loss). Web client does not emit a custom event.
        clientSocket.on('disconnect', () => {
            void events.OnDisconnect(clientSocket as AuthenticatedSocket, registry);
        })
        // (3) OnLeave (ABORT): Protected. Users can leave 
        // Return (not `void`) the promise so authorizeSocket awaits it and its try/catch contains any rejection.
        clientSocket.on('document:leave', authorizeSocket(clientSocket as AuthenticatedSocket, registry, (socket, workspace, _documentPublicId: string) => events.OnLeave(socket, workspace, registry), { requireDocumentPublicId: true, errorEvent: 'document:leave:error' }))


        // Settings 
        // (4) Proof settings opened (ABORT): Protected. Users can open the proof settings
        clientSocket.on('document:settings:opened', authorizeSocket(clientSocket as AuthenticatedSocket, registry, events.SettingsOpened, { errorEvent: 'document:settings:opened:error' }))
        // (5) Math Statement added: Protected. Users can update math statements that impact doc state 
        clientSocket.on('document:mathStatement:added', authorizeSocket(clientSocket as AuthenticatedSocket, registry, events.MathStatementAdded, { errorEvent: 'document:mathStatement:error' }))
        // (6) Math Statement removed: Protected. Users can update math statements that impact doc state 
        clientSocket.on('document:mathStatement:removed', authorizeSocket(clientSocket as AuthenticatedSocket, registry, events.MathStatementRemoved, { errorEvent: 'document:mathStatement:error' }))
        // (7) Lemma added: Protected. Users can update lemmas that impact doc state 
        clientSocket.on('document:lemma:added', authorizeSocket(clientSocket as AuthenticatedSocket, registry, events.LemmaAdded, { errorEvent: 'document:lemma:error' }))
        // (8) Lemma removed: Protected. Users can update lemmas that impact doc state 
        clientSocket.on('document:lemma:removed', authorizeSocket(clientSocket as AuthenticatedSocket, registry, events.LemmaRemoved, { errorEvent: 'document:lemma:error' }))
        // (9) Proof type updated: Protected. Users can change the proof type or clear it. Also add strictness
        clientSocket.on('document:proofType:updated', authorizeSocket(clientSocket as AuthenticatedSocket, registry, events.ProofTypeUpdated, { errorEvent: 'document:proofType:error' }))
        // (10) Settings closed
        clientSocket.on('document:settings:closed', authorizeSocket(clientSocket as AuthenticatedSocket, registry, events.SettingsClosed, { errorEvent: 'document:settings:closed:error' }))


        // ==== ABORT BODY PIPELINE ====
        // (1) OnBodyDelta: Protected. Users can send body edits
        clientSocket.on('document:delta', authorizeSocket(clientSocket as AuthenticatedSocket, registry, (socket, workspace, payload: WireDeltaPayload) => {
            events.BodyDelta(socket, workspace, normalizeWireDelta(payload, 'content'));
        }, { errorEvent: 'document:delta:error' }))

        // SERVER sends
        // (1) ProvableStatus: Send idle, analyizng, provabe, unprovable status to clients
        

    })
})()
