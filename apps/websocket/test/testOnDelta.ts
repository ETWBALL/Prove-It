import { io, type Socket } from "socket.io-client"
import { generateAccessToken } from "@prove-it/auth"
import type { Delta } from "../lib/types"

type DeltaTestResult = {
    name: string
    passed: boolean
    details: string
}

type DeltaTestCase = () => Promise<DeltaTestResult>

const SERVER_URL = "http://127.0.0.1:3001"
const CONNECT_TIMEOUT_MS = 5000

// IMPORTANT: Update these IDs to match your seeded DB.
const USER_PUBLIC_ID = "cmovkq80m0001su7yhycdliwn"
const SESSION_PUBLIC_ID = "cmovkq80x0003su7yshtt4z7s"
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

function disconnectQuietly(socket: Socket): void {
    if (socket.connected) socket.disconnect()
    else socket.close()
}

async function joinDocument(socket: Socket, documentId: string): Promise<any> {
    socket.emit("document:join", documentId)

    // If join fails, we want a clear error rather than hanging.
    // This assumes server emits exactly one of these.
    const joinSuccess = await Promise.race([
        waitForEvent<any>(socket, "document:join:success"),
        waitForEvent<any>(socket, "document:join:error").then((errPayload) => {
            throw new Error(`join:error ${JSON.stringify(errPayload)}`)
        }),
    ])

    return joinSuccess
}

async function sendDeltaExpectAckOrError(
    socket: Socket,
    delta: Delta
): Promise<{ revision: number } | { code: string; [k: string]: unknown }> {
    socket.emit("document:delta", delta)

    return Promise.race([
        waitForEvent<{ revision: number }>(socket, "document:delta:ack").then((ack) => ack),
        waitForEvent<any>(socket, "document:delta:error").then((errPayload) => errPayload),
    ])
}

function buildInsertDelta(documentId: string, revision: number, content: string): Delta {
    // insert => startIndex must equal endIndex
    return {
        type: "insert",
        startIndex: 0,
        endIndex: 0,
        content,
        documentId,
        revision,
    }
}

async function main() {
    const results: DeltaTestResult[] = []

    // Add test cases one-by-one.
    const tests: DeltaTestCase[] = [
        // Test 1: Calling document:delta before document:join should fail with UNAUTHORIZED.
        async () => {
            const socket = await createAuthedSocket()
            try {
                await waitForConnect(socket)

                // Revision does not matter here; we should fail early at the UNAUTHORIZED check.
                const delta = buildInsertDelta(SECOND_DOCUMENT_PUBLIC_ID, 1, "Hello")
                socket.emit("document:delta", delta)

                const err = await waitForEvent<{ code?: string }>(
                    socket,
                    "document:delta:error"
                )
                const passed = err?.code === "UNAUTHORIZED"
                return {
                    name: "onDelta UNAUTHORIZED when delta sent before join",
                    passed,
                    details: passed ? "Received code UNAUTHORIZED as expected." : `Unexpected: ${JSON.stringify(err)}`,
                }
            } catch (error) {
                return {
                    name: "onDelta UNAUTHORIZED when delta sent before join",
                    passed: false,
                    details: String(error),
                }
            } finally {
                disconnectQuietly(socket)
            }
        },

        // Test 2: After joining doc A, sending a delta with documentId for doc B should fail with FORBIDDEN.
        async () => {
            const socket = await createAuthedSocket()
            try {
                await waitForConnect(socket)

                socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                await waitForEvent(socket, "document:join:success")

                // Revision does not matter because we should fail early at the FORBIDDEN check.
                const delta = buildInsertDelta(SECOND_DOCUMENT_PUBLIC_ID, 1, "Hello")
                socket.emit("document:delta", delta)

                const err = await waitForEvent<{ code?: string }>(
                    socket,
                    "document:delta:error"
                )
                const passed = err?.code === "FORBIDDEN"
                return {
                    name: "onDelta FORBIDDEN when delta.documentId mismatches joined document",
                    passed,
                    details: passed ? "Received code FORBIDDEN as expected." : `Unexpected: ${JSON.stringify(err)}`,
                }
            } catch (error) {
                return {
                    name: "onDelta FORBIDDEN when delta.documentId mismatches joined document",
                    passed: false,
                    details: String(error),
                }
            } finally {
                disconnectQuietly(socket)
            }
        },

        // Test 3: Revision mismatch should fail with REVISION_MISMATCH and include expectedRevision.
        async () => {
            const socket = await createAuthedSocket()
            try {
                await waitForConnect(socket)

                socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                const joinSuccess = await waitForEvent<{
                    revision?: number
                }>(socket, "document:join:success")

                const currentRevision = joinSuccess?.revision ?? 0
                const expectedRevision = currentRevision + 1

                // Force a revision mismatch.
                const wrongRevision = expectedRevision + 5
                const delta: Delta = {
                    type: "insert",
                    startIndex: 0,
                    endIndex: 0,
                    content: "Hello",
                    documentId: DOCUMENT_PUBLIC_ID,
                    revision: wrongRevision,
                }

                socket.emit("document:delta", delta)

                const err = await waitForEvent<{
                    code?: string
                    expectedRevision?: number
                }>(socket, "document:delta:error")

                const passed =
                    err?.code === "REVISION_MISMATCH" && err?.expectedRevision === expectedRevision

                return {
                    name: "onDelta REVISION_MISMATCH when revision is wrong",
                    passed,
                    details: passed
                        ? "Got REVISION_MISMATCH with correct expectedRevision."
                        : `Unexpected error: ${JSON.stringify(err)} (expectedRevision=${expectedRevision})`,
                }
            } catch (error) {
                return {
                    name: "onDelta REVISION_MISMATCH when revision is wrong",
                    passed: false,
                    details: String(error),
                }
            } finally {
                disconnectQuietly(socket)
            }
        },

        // Test 4: Insert with startIndex !== endIndex should fail validateDeltaForContent with INVALID_INSERT_RANGE.
        async () => {
            const socket = await createAuthedSocket()
            try {
                await waitForConnect(socket)

                socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                const joinSuccess = await waitForEvent<{
                    revision?: number
                    content?: string
                }>(socket, "document:join:success")

                const currentRevision = joinSuccess?.revision ?? 0
                const expectedRevision = currentRevision + 1
                const contentLength = (joinSuccess?.content ?? "").length

                // Ensure indices are in-bounds; if the document is too short to pick 2 distinct indices,
                // fall back to forcing out-of-bounds logic in another test.
                const startIndex = 0
                const endIndex = contentLength >= 2 ? 1 : 0

                if (startIndex === endIndex) {
                    return {
                        name: "onDelta INVALID_INSERT_RANGE when startIndex != endIndex",
                        passed: false,
                        details:
                            "Document content is too short for this specific invalid insert-range case (need endIndex != startIndex).",
                    }
                }

                const delta: Delta = {
                    type: "insert",
                    startIndex,
                    endIndex,
                    content: "X",
                    documentId: DOCUMENT_PUBLIC_ID,
                    revision: expectedRevision,
                }

                socket.emit("document:delta", delta)

                const err = await waitForEvent<{ code?: string }>(socket, "document:delta:error")
                const passed = err?.code === "INVALID_INSERT_RANGE"

                return {
                    name: "onDelta INVALID_INSERT_RANGE when insert range invalid",
                    passed,
                    details: passed ? "Got INVALID_INSERT_RANGE." : `Unexpected error: ${JSON.stringify(err)}`,
                }
            } catch (error) {
                return {
                    name: "onDelta INVALID_INSERT_RANGE when insert range invalid",
                    passed: false,
                    details: String(error),
                }
            } finally {
                disconnectQuietly(socket)
            }
        },

        // Test 5: Non-string delta.content should fail validateDeltaForContent with INVALID_CONTENT.
        async () => {
            const socket = await createAuthedSocket()
            try {
                await waitForConnect(socket)

                socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                const joinSuccess = await waitForEvent<{
                    revision?: number
                }>(socket, "document:join:success")

                const currentRevision = joinSuccess?.revision ?? 0
                const expectedRevision = currentRevision + 1

                const delta = {
                    type: "insert",
                    startIndex: 0,
                    endIndex: 0,
                    content: 123, // intentional: should be string
                    documentId: DOCUMENT_PUBLIC_ID,
                    revision: expectedRevision,
                } as unknown as Delta

                socket.emit("document:delta", delta)

                const err = await waitForEvent<{ code?: string }>(socket, "document:delta:error")
                const passed = err?.code === "INVALID_CONTENT"

                return {
                    name: "onDelta INVALID_CONTENT when content is not string",
                    passed,
                    details: passed ? "Got INVALID_CONTENT." : `Unexpected error: ${JSON.stringify(err)}`,
                }
            } catch (error) {
                return {
                    name: "onDelta INVALID_CONTENT when content is not string",
                    passed: false,
                    details: String(error),
                }
            } finally {
                disconnectQuietly(socket)
            }
        },

        // Test 6: Out-of-bounds indices should fail validateDeltaForContent with INDEX_OUT_OF_BOUNDS.
        async () => {
            const socket = await createAuthedSocket()
            try {
                await waitForConnect(socket)

                socket.emit("document:join", DOCUMENT_PUBLIC_ID)
                const joinSuccess = await waitForEvent<{
                    revision?: number
                }>(socket, "document:join:success")

                const currentRevision = joinSuccess?.revision ?? 0
                const expectedRevision = currentRevision + 1

                const outOfBounds = 999999
                const delta: Delta = {
                    type: "insert",
                    startIndex: outOfBounds,
                    endIndex: outOfBounds,
                    content: "X",
                    documentId: DOCUMENT_PUBLIC_ID,
                    revision: expectedRevision,
                }

                socket.emit("document:delta", delta)

                const err = await waitForEvent<{ code?: string }>(socket, "document:delta:error")
                const passed = err?.code === "INDEX_OUT_OF_BOUNDS"

                return {
                    name: "onDelta INDEX_OUT_OF_BOUNDS when indices exceed content length",
                    passed,
                    details: passed ? "Got INDEX_OUT_OF_BOUNDS." : `Unexpected error: ${JSON.stringify(err)}`,
                }
            } catch (error) {
                return {
                    name: "onDelta INDEX_OUT_OF_BOUNDS when indices exceed content length",
                    passed: false,
                    details: String(error),
                }
            } finally {
                disconnectQuietly(socket)
            }
        },

        // Test 7: Valid insert updates hot RAM state (content + revision) and is visible on idempotent re-join.
        async () => {
            const socket = await createAuthedSocket()
            try {
                await waitForConnect(socket)

                const firstJoin = await joinDocument(socket, DOCUMENT_PUBLIC_ID)
                const initialContent = firstJoin?.content ?? ""
                const initialRevision = firstJoin?.revision ?? 0

                const inserted = "HOT_STATE_INSERT"
                const delta: Delta = {
                    type: "insert",
                    startIndex: 0,
                    endIndex: 0,
                    content: inserted,
                    documentId: DOCUMENT_PUBLIC_ID,
                    revision: initialRevision + 1,
                }

                const result = await sendDeltaExpectAckOrError(socket, delta)
                if ("code" in result) {
                    return {
                        name: "onDelta insert updates hot RAM state",
                        passed: false,
                        details: `Expected ack, got error: ${JSON.stringify(result)}`,
                    }
                }

                // Idempotent join returns state from in-memory map for this socket/document.
                const secondJoin = await joinDocument(socket, DOCUMENT_PUBLIC_ID)
                const expectedContent = inserted + initialContent
                const expectedRevision = initialRevision + 1

                const passed =
                    secondJoin?.content === expectedContent &&
                    secondJoin?.revision === expectedRevision

                return {
                    name: "onDelta insert updates hot RAM state",
                    passed,
                    details: passed
                        ? "Content and revision reflected updated in-memory state."
                        : `Unexpected re-join state: ${JSON.stringify({
                              expectedContentPrefix: inserted,
                              expectedRevision,
                              gotContent: secondJoin?.content,
                              gotRevision: secondJoin?.revision,
                          })}`,
                }
            } catch (error) {
                return {
                    name: "onDelta insert updates hot RAM state",
                    passed: false,
                    details: String(error),
                }
            } finally {
                disconnectQuietly(socket)
            }
        },

        // Test 8: 30 valid inserts should trigger immediate persistence event.
        async () => {
            const socket = await createAuthedSocket()
            try {
                await waitForConnect(socket)

                const joinSuccess = await joinDocument(socket, DOCUMENT_PUBLIC_ID)
                const startRevision = joinSuccess?.revision ?? 0

                // Send first 29 inserts and expect ack each time.
                for (let i = 1; i <= 29; i++) {
                    const delta: Delta = {
                        type: "insert",
                        startIndex: 0,
                        endIndex: 0,
                        content: `A${i}`,
                        documentId: DOCUMENT_PUBLIC_ID,
                        revision: startRevision + i,
                    }

                    const result = await sendDeltaExpectAckOrError(socket, delta)
                    if ("code" in result) {
                        return {
                            name: "onDelta persists when buffer reaches 30 inserts",
                            passed: false,
                            details: `Insert ${i} failed: ${JSON.stringify(result)}`,
                        }
                    }
                }

                // Set listener before the 30th insert to avoid missing the persisted event.
                const persistedPromise = waitForEvent<{ message?: string }>(
                    socket,
                    "document:delta:persisted",
                    10000
                )

                const thirtiethDelta: Delta = {
                    type: "insert",
                    startIndex: 0,
                    endIndex: 0,
                    content: "A30",
                    documentId: DOCUMENT_PUBLIC_ID,
                    revision: startRevision + 30,
                }

                const finalResult = await sendDeltaExpectAckOrError(socket, thirtiethDelta)
                if ("code" in finalResult) {
                    return {
                        name: "onDelta persists when buffer reaches 30 inserts",
                        passed: false,
                        details: `30th insert failed: ${JSON.stringify(finalResult)}`,
                    }
                }

                const persisted = await persistedPromise
                const passed =
                    typeof persisted?.message === "string" &&
                    persisted.message.includes("persisted")

                return {
                    name: "onDelta persists when buffer reaches 30 inserts",
                    passed,
                    details: passed
                        ? "Received document:delta:persisted after 30th insert."
                        : `Unexpected persisted payload: ${JSON.stringify(persisted)}`,
                }
            } catch (error) {
                return {
                    name: "onDelta persists when buffer reaches 30 inserts",
                    passed: false,
                    details: String(error),
                }
            } finally {
                disconnectQuietly(socket)
            }
        },
    ]

    for (const testCase of tests) {
        results.push(await testCase())
    }

    console.log("\n=== onDelta Results ===")
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
    SERVER_URL,
    USER_PUBLIC_ID,
    SESSION_PUBLIC_ID,
    DOCUMENT_PUBLIC_ID,
    SECOND_DOCUMENT_PUBLIC_ID,
    createSocket,
    createAuthedSocket,
    waitForConnect,
    waitForEvent,
    disconnectQuietly,
    joinDocument,
    sendDeltaExpectAckOrError,
    buildInsertDelta,
}

