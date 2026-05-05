import { io, type Socket } from "socket.io-client"
import { authEnv, generateAccessToken } from "@prove-it/auth"
import { SignJWT } from "jose"

type JoinTestResult = {
    name: string
    passed: boolean
    details: string
}

type JoinTestCase = () => Promise<JoinTestResult>

const SERVER_URL = "http://127.0.0.1:3001"
const CONNECT_TIMEOUT_MS = 5000

// Replace these with your own fixture IDs as needed.
const USER_PUBLIC_ID = "cmostgrdm0004suyxpeg1eqtr"
const SECOND_USER_PUBLIC_ID = "cmorwcm7j0006su8rzzzzzzzz"
const SESSION_PUBLIC_ID = "cmostgrdm0005suyxhpl8yg4m"
const DOCUMENT_PUBLIC_ID = "cmostgreo0007suyx6kn89hp3"
const SECOND_DOCUMENT_PUBLIC_ID = "cmostgrh9000asuyxk3dzpw10"

function createSocket(auth?: Record<string, unknown>): Socket {
    return io(SERVER_URL, {
        auth,
        forceNew: true,
        reconnection: false,
        timeout: CONNECT_TIMEOUT_MS,
        transports: ["websocket"],
    })
}

async function createAuthedSocket(overrides?: {
    userPublicId?: string
    sessionPublicId?: string
}): Promise<Socket> {
    const token = await generateAccessToken({
        publicId: overrides?.userPublicId ?? USER_PUBLIC_ID,
        sessionPublicId: overrides?.sessionPublicId ?? SESSION_PUBLIC_ID,
    })
    return createSocket({ accessToken: token })
}

async function createTokenWithoutPublicId(): Promise<string> {
    return new SignJWT({ sessionPublicId: SESSION_PUBLIC_ID })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer(authEnv.APP_URL)
        .setAudience(authEnv.APP_URL)
        .setExpirationTime(authEnv.ACCESS_TOKEN_EXPIRES_IN)
        .sign(new TextEncoder().encode(authEnv.ACCESS_TOKEN_JWT_SECRET))
}

function waitForConnect(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`connect timed out after ${CONNECT_TIMEOUT_MS}ms`))
        }, CONNECT_TIMEOUT_MS)

        socket.once("connect", () => {
            clearTimeout(timer)
            resolve()
        })

        socket.once("connect_error", (err) => {
            clearTimeout(timer)
            reject(new Error(`connect_error: ${err.message}`))
        })
    })
}

function waitForEvent<T = unknown>(
    socket: Socket,
    eventName: string,
    timeoutMs: number = CONNECT_TIMEOUT_MS
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${eventName} timed out after ${timeoutMs}ms`))
        }, timeoutMs)

        socket.once(eventName, (payload: T) => {
            clearTimeout(timer)
            resolve(payload)
        })
    })
}

function waitForNoEvent(
    socket: Socket,
    eventName: string,
    durationMs: number = 750
): Promise<boolean> {
    return new Promise((resolve) => {
        let seen = false
        const onEvent = () => {
            seen = true
        }
        socket.once(eventName, onEvent)
        setTimeout(() => {
            socket.off(eventName, onEvent)
            resolve(!seen)
        }, durationMs)
    })
}

function disconnectQuietly(socket: Socket): void {
    if (socket.connected) {
        socket.disconnect()
        return
    }
    socket.close()
}

async function main() {
    const results: JoinTestResult[] = []

    const tests: JoinTestCase[] = [
        // Test 1: Unauthorized user (missing publicId on verified payload) gets document:join:error UNAUTHORIZED.
        async () => {
            const tokenWithoutPublicId = await createTokenWithoutPublicId()
            const socket = createSocket({ accessToken: tokenWithoutPublicId })

            try {
                await waitForConnect(socket)
                socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                const payload = await waitForEvent<{ code?: string }>(socket, "document:join:error")
                const passed = payload?.code === "UNAUTHORIZED"
                return {
                    name: "onJoin unauthorized user",
                    passed,
                    details: passed
                        ? "Received document:join:error with UNAUTHORIZED"
                        : `Unexpected payload: ${JSON.stringify(payload)}`,
                }
            } catch (error) {
                return {
                    name: "onJoin unauthorized user",
                    passed: false,
                    details: String(error),
                }
            } finally {
                disconnectQuietly(socket)
            }
        },

        // Test 2: Authorized user can join their document and receives success payload.
        async () => {
            const socket = await createAuthedSocket()
            try {
                await waitForConnect(socket)
                socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                const payload = await waitForEvent<{ documentId?: string }>(socket, "document:join:success")
                const passed = payload?.documentId === DOCUMENT_PUBLIC_ID
                return {
                    name: "onJoin authorized user",
                    passed,
                    details: passed
                        ? "Received document:join:success for target document"
                        : `Unexpected payload: ${JSON.stringify(payload)}`,
                }
            } catch (error) {
                return {
                    name: "onJoin authorized user",
                    passed: false,
                    details: String(error),
                }
            } finally {
                disconnectQuietly(socket)
            }
        },

        // Test 3: Same user joins same document in tab 2; tab 1 should be disconnected by takeover logic.
        async () => {
            let tab1: Socket | null = null
            let tab2: Socket | null = null
            try {
                tab1 = await createAuthedSocket()
                await waitForConnect(tab1)
                
                tab1.emit("document:join", DOCUMENT_PUBLIC_ID)
                await waitForEvent(tab1, "document:join:success")

                const tab1Disconnected = waitForEvent<string>(tab1, "disconnect")

                tab2 = await createAuthedSocket()
                await waitForConnect(tab2)
                tab2.emit("document:join", DOCUMENT_PUBLIC_ID)

                const [tab2Success, disconnectReason] = await Promise.all([
                    waitForEvent<{ documentId?: string }>(tab2, "document:join:success"),
                    tab1Disconnected,
                ])

                const passed =
                    tab2Success?.documentId === DOCUMENT_PUBLIC_ID && disconnectReason === "io server disconnect"

                return {
                    name: "onJoin same-user tab takeover",
                    passed,
                    details: passed
                        ? "Tab 2 joined successfully and tab 1 was disconnected by server."
                        : `Unexpected outcomes: tab2=${JSON.stringify(tab2Success)} disconnectReason=${disconnectReason}`,
                }
            } catch (error) {
                return {
                    name: "onJoin same-user tab takeover",
                    passed: false,
                    details: String(error),
                }
            } finally {
                if (tab1) disconnectQuietly(tab1)
                if (tab2) disconnectQuietly(tab2)
            }
        },
        
        // Test 4: Same socket joins the same document 
        async () => {
            const socket = await createAuthedSocket()
            try {
                await waitForConnect(socket)

                socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                const firstJoin = await waitForEvent<{
                    documentId?: string
                    content?: string
                    revision?: number
                    buffer?: unknown[]
                }>(socket, "document:join:success")

                socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                const secondJoin = await waitForEvent<{
                    documentId?: string
                    content?: string
                    revision?: number
                    buffer?: unknown[]
                }>(socket, "document:join:success")

                const passed =
                    firstJoin?.documentId === DOCUMENT_PUBLIC_ID &&
                    secondJoin?.documentId === DOCUMENT_PUBLIC_ID &&
                    firstJoin?.content === secondJoin?.content &&
                    firstJoin?.revision === secondJoin?.revision &&
                    JSON.stringify(firstJoin?.buffer ?? []) === JSON.stringify(secondJoin?.buffer ?? [])

                return {
                    name: "onJoin same-socket same-document idempotent join",
                    passed,
                    details: passed
                        ? "Second join on same socket returned same document state successfully."
                        : `Join responses differed: first=${JSON.stringify(firstJoin)} second=${JSON.stringify(secondJoin)}`,
                }
            } catch (error) {
                return {
                    name: "onJoin same-socket same-document idempotent join",
                    passed: false,
                    details: String(error),
                }
            } finally {
                disconnectQuietly(socket)
            }
        },

        // Test 5: Only unique sockets per document. That is, the same socket can not be at two documents at once
        async () => {
            const socket = await createAuthedSocket()
            try {
                await waitForConnect(socket)

                socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                const firstJoin = await waitForEvent<{ documentId?: string }>(
                    socket,
                    "document:join:success"
                )
                if (firstJoin?.documentId !== DOCUMENT_PUBLIC_ID) {
                    return {
                        name: "onJoin single-socket single-document enforcement",
                        passed: false,
                        details: `Failed initial join: ${JSON.stringify(firstJoin)}`,
                    }
                }

                socket.emit("document:join", SECOND_DOCUMENT_PUBLIC_ID)
                const secondJoinError = await waitForEvent<{ code?: string }>(
                    socket,
                    "document:join:error"
                )

                const passed = secondJoinError?.code === "ALREADY_IN_DOCUMENT"
                return {
                    name: "onJoin single-socket single-document enforcement",
                    passed,
                    details: passed
                        ? "Second join attempt on same socket was rejected with ALREADY_IN_DOCUMENT."
                        : `Unexpected error payload: ${JSON.stringify(secondJoinError)}`,
                }
            } catch (error) {
                return {
                    name: "onJoin single-socket single-document enforcement",
                    passed: false,
                    details: String(error),
                }
            } finally {
                disconnectQuietly(socket)
            }
        },

        // Test 6: Different user cannot join a document that is already actively opened by another user.
        async () => {
            let user1Socket: Socket | null = null
            let user2Socket: Socket | null = null
            try {
                // User 1 joins first and holds the lock.
                user1Socket = await createAuthedSocket({ userPublicId: USER_PUBLIC_ID })
                await waitForConnect(user1Socket)
                user1Socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                const user1Join = await waitForEvent<{ documentId?: string }>(
                    user1Socket,
                    "document:join:success"
                )
                if (user1Join?.documentId !== DOCUMENT_PUBLIC_ID) {
                    return {
                        name: "onJoin document locked for different user",
                        passed: false,
                        details: `User1 failed initial join: ${JSON.stringify(user1Join)}`,
                    }
                }

                // User 2 attempts same document and should be rejected.
                user2Socket = await createAuthedSocket({ userPublicId: SECOND_USER_PUBLIC_ID })
                await waitForConnect(user2Socket)
                user2Socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                const user2Error = await waitForEvent<{ code?: string }>(
                    user2Socket,
                    "document:join:error"
                )

                const passed = user2Error?.code === "DOCUMENT_LOCKED"
                return {
                    name: "onJoin document locked for different user",
                    passed,
                    details: passed
                        ? "Second user blocked with DOCUMENT_LOCKED while first user holds document."
                        : `Unexpected payload: ${JSON.stringify(user2Error)}`,
                }
            } catch (error) {
                return {
                    name: "onJoin document locked for different user",
                    passed: false,
                    details: String(error),
                }
            } finally {
                if (user1Socket) disconnectQuietly(user1Socket)
                if (user2Socket) disconnectQuietly(user2Socket)
            }
        },

        // Test 7: User can hold two different documents at once if they are different sockets (tabs).
        async () => {
            let tab1: Socket | null = null
            let tab2: Socket | null = null
            try {
                tab1 = await createAuthedSocket({ userPublicId: USER_PUBLIC_ID })
                await waitForConnect(tab1)
                tab1.emit("document:join", DOCUMENT_PUBLIC_ID)
                const tab1Join = await waitForEvent<{ documentId?: string }>(tab1, "document:join:success")
                if (tab1Join?.documentId !== DOCUMENT_PUBLIC_ID) {
                    return {
                        name: "onJoin same-user different-doc different-tabs allowed",
                        passed: false,
                        details: `Tab1 failed initial join: ${JSON.stringify(tab1Join)}`,
                    }
                }

                tab2 = await createAuthedSocket({ userPublicId: USER_PUBLIC_ID })
                await waitForConnect(tab2)
                tab2.emit("document:join", SECOND_DOCUMENT_PUBLIC_ID)
                const tab2Join = await waitForEvent<{ documentId?: string }>(tab2, "document:join:success")
                const tab1NotKicked = await waitForNoEvent(tab1, "disconnect")

                const passed = tab2Join?.documentId === SECOND_DOCUMENT_PUBLIC_ID && tab1NotKicked
                return {
                    name: "onJoin same-user different-doc different-tabs allowed",
                    passed,
                    details: passed
                        ? "Both tabs stayed active on different documents."
                        : `Unexpected outcomes: tab2=${JSON.stringify(tab2Join)} tab1StillConnected=${tab1NotKicked}`,
                }
            } catch (error) {
                return {
                    name: "onJoin same-user different-doc different-tabs allowed",
                    passed: false,
                    details: String(error),
                }
            } finally {
                if (tab1) disconnectQuietly(tab1)
                if (tab2) disconnectQuietly(tab2)
            }
        },

        // Test 8: Join non-owned/non-existent document should emit FORBIDDEN (after processing).
        async () => {
            const socket = await createAuthedSocket({ userPublicId: USER_PUBLIC_ID })
            const NON_OWNED_OR_MISSING_DOCUMENT_ID = "cmorwcm810007su8rmissingdoc"
            try {
                await waitForConnect(socket)
                socket.emit("document:join", NON_OWNED_OR_MISSING_DOCUMENT_ID)

                const processing = await waitForEvent<{ documentId?: string }>(socket, "document:join:processing")
                const joinError = await waitForEvent<{ code?: string }>(socket, "document:join:error")
                const passed =
                    processing?.documentId === NON_OWNED_OR_MISSING_DOCUMENT_ID &&
                    joinError?.code === "FORBIDDEN"

                return {
                    name: "onJoin forbidden when doc missing or not owned",
                    passed,
                    details: passed
                        ? "Received processing then FORBIDDEN as expected."
                        : `Unexpected payloads: processing=${JSON.stringify(processing)} error=${JSON.stringify(joinError)}`,
                }
            } catch (error) {
                return {
                    name: "onJoin forbidden when doc missing or not owned",
                    passed: false,
                    details: String(error),
                }
            } finally {
                disconnectQuietly(socket)
            }
        },

        // Test 9: Repeated same-user takeovers should always kick the previous tab and keep the newest tab active.
        async () => {
            let tab1: Socket | null = null
            let tab2: Socket | null = null
            let tab3: Socket | null = null
            try {
                tab1 = await createAuthedSocket({ userPublicId: USER_PUBLIC_ID })
                await waitForConnect(tab1)
                tab1.emit("document:join", DOCUMENT_PUBLIC_ID)
                await waitForEvent(tab1, "document:join:success")

                const tab1DisconnectPromise = waitForEvent<string>(tab1, "disconnect")
                tab2 = await createAuthedSocket({ userPublicId: USER_PUBLIC_ID })
                await waitForConnect(tab2)
                tab2.emit("document:join", DOCUMENT_PUBLIC_ID)
                const tab2Join = await waitForEvent<{ documentId?: string }>(tab2, "document:join:success")
                const tab1DisconnectReason = await tab1DisconnectPromise
                if (
                    tab2Join?.documentId !== DOCUMENT_PUBLIC_ID ||
                    tab1DisconnectReason !== "io server disconnect"
                ) {
                    return {
                        name: "onJoin repeated same-user takeovers",
                        passed: false,
                        details: `First takeover failed: tab2=${JSON.stringify(tab2Join)} tab1Reason=${tab1DisconnectReason}`,
                    }
                }

                const tab2DisconnectPromise = waitForEvent<string>(tab2, "disconnect")
                tab3 = await createAuthedSocket({ userPublicId: USER_PUBLIC_ID })
                await waitForConnect(tab3)
                tab3.emit("document:join", DOCUMENT_PUBLIC_ID)
                const tab3Join = await waitForEvent<{ documentId?: string }>(tab3, "document:join:success")
                const tab2DisconnectReason = await tab2DisconnectPromise

                const passed =
                    tab3Join?.documentId === DOCUMENT_PUBLIC_ID &&
                    tab2DisconnectReason === "io server disconnect"
                return {
                    name: "onJoin repeated same-user takeovers",
                    passed,
                    details: passed
                        ? "Tab1 was replaced by Tab2, then Tab2 was replaced by Tab3 as expected."
                        : `Unexpected outcomes: tab3=${JSON.stringify(tab3Join)} tab2Reason=${tab2DisconnectReason}`,
                }
            } catch (error) {
                return {
                    name: "onJoin repeated same-user takeovers",
                    passed: false,
                    details: String(error),
                }
            } finally {
                if (tab1) disconnectQuietly(tab1)
                if (tab2) disconnectQuietly(tab2)
                if (tab3) disconnectQuietly(tab3)
            }
        },

        // Test 10: Document lock should clear after holder disconnects, allowing another user to join.
        async () => {
            let user1Socket: Socket | null = null
            let user2Socket: Socket | null = null
            try {
                user1Socket = await createAuthedSocket({ userPublicId: USER_PUBLIC_ID })
                await waitForConnect(user1Socket)
                user1Socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                const user1Join = await waitForEvent<{ documentId?: string }>(
                    user1Socket,
                    "document:join:success"
                )
                if (user1Join?.documentId !== DOCUMENT_PUBLIC_ID) {
                    return {
                        name: "onJoin lock releases after disconnect",
                        passed: false,
                        details: `User1 failed initial join: ${JSON.stringify(user1Join)}`,
                    }
                }

                // Close lock holder connection to simulate tab close/network drop.
                disconnectQuietly(user1Socket)
                await new Promise((resolve) => setTimeout(resolve, 200))

                user2Socket = await createAuthedSocket({ userPublicId: USER_PUBLIC_ID })
                await waitForConnect(user2Socket)
                user2Socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                const user2Join = await waitForEvent<{ documentId?: string }>(
                    user2Socket,
                    "document:join:success"
                )

                const passed = user2Join?.documentId === DOCUMENT_PUBLIC_ID
                return {
                    name: "onJoin lock releases after disconnect",
                    passed,
                    details: passed
                        ? "Second user joined successfully after first user disconnected."
                        : `Unexpected payload: ${JSON.stringify(user2Join)}`,
                }
            } catch (error) {
                return {
                    name: "onJoin lock releases after disconnect",
                    passed: false,
                    details: String(error),
                }
            } finally {
                if (user1Socket) disconnectQuietly(user1Socket)
                if (user2Socket) disconnectQuietly(user2Socket)
            }
        },

    ]
    
    



    for (const testCase of tests) {
        results.push(await testCase())
    }

    console.log("\n=== onJoin Results ===")
    if (results.length === 0) {
        console.log("No test cases added yet.")
        process.exit(0)
    }

    for (const result of results) {
        const status = result.passed ? "✅PASS" : "❌FAIL"
        console.log(`${status} - ${result.name}: ${result.details}`)
    }

    const hasFailure = results.some((result) => !result.passed)
    process.exit(hasFailure ? 1 : 0)
}

main().catch((error) => {
    console.error("Unhandled test failure:", error)
    process.exit(1)
})

export {
    DOCUMENT_PUBLIC_ID,
    USER_PUBLIC_ID,
    SESSION_PUBLIC_ID,
    createSocket,
    createAuthedSocket,
    waitForConnect,
    waitForEvent,
    disconnectQuietly,
}
