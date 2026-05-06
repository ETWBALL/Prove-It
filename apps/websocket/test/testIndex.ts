// test/01-connection.ts
import { io, type Socket } from "socket.io-client"
import { authEnv, generateAccessToken } from "@prove-it/auth"
import { SignJWT } from "jose"

const USER_PUBLIC_ID = "cmorwcm7j0004su8ryyda348e"
const SESSION_PUBLIC_ID = "cmorwcm7j0005su8rrcd4tdh8"
const SERVER_URL = "http://127.0.0.1:3001"
const CONNECT_TIMEOUT_MS = 5000


type TestResult = { name: string; passed: boolean; details: string }

function createSocket(auth?: Record<string, unknown>): Socket {
    // Create an isolated client for each test so previous attempts do not leak state.
    return io(SERVER_URL, {
        auth,
        forceNew: true,
        reconnection: false,
        timeout: CONNECT_TIMEOUT_MS,
        transports: ["websocket"],
    })
}

async function expectRejected(
    name: string,
    auth?: Record<string, unknown>,
    expectedMessages: string[] = ["Unauthorized"]
): Promise<TestResult> {
    return new Promise((resolve) => {
        // This helper asserts that connection never succeeds and fails with an expected message.
        const socket = createSocket(auth)
        const timer = setTimeout(() => {
            socket.disconnect()
            resolve({ name, passed: false, details: `Timed out after ${CONNECT_TIMEOUT_MS}ms` })
        }, CONNECT_TIMEOUT_MS)

        socket.on("connect", () => {
            clearTimeout(timer)
            socket.disconnect()
            resolve({ name, passed: false, details: "Unexpectedly connected" })
        })

        socket.on("connect_error", (err) => {
            clearTimeout(timer)
            socket.disconnect()
            if (expectedMessages.includes(err.message)) {
                resolve({ name, passed: true, details: `Rejected as expected: ${err.message}` })
                return
            }
            resolve({
                name,
                passed: false,
                details: `Rejected with unexpected message: ${err.message}`,
            })
        })
    })
}

async function generateTestAccessToken(publicId: string, sessionPublicId: string, expiration: string, secret: string, issuer: string, audience: string): Promise<string> {
    return new SignJWT({ publicId, sessionPublicId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(issuer)        
    .setAudience(audience)  
    .setExpirationTime(expiration)
    .sign(new TextEncoder().encode(secret))
}

async function expectConnected(name: string, auth: { accessToken: string }): Promise<TestResult> {
    return new Promise((resolve) => {
        // This helper asserts a successful handshake and treats any connect_error as a failure.
        const socket = createSocket(auth)
        const timer = setTimeout(() => {
            socket.disconnect()
            resolve({ name, passed: false, details: `Timed out after ${CONNECT_TIMEOUT_MS}ms` })
        }, CONNECT_TIMEOUT_MS)

        socket.on("connect", () => {
            clearTimeout(timer)
            const socketId = socket.id
            socket.disconnect()
            resolve({ name, passed: true, details: `Connected with socket id: ${socketId}` })
        })

        socket.on("connect_error", (err) => {
            clearTimeout(timer)
            socket.disconnect()
            resolve({ name, passed: false, details: `Unexpected rejection: ${err.message}` })
        })
    })
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function hasNonEmptyValue(value: string | undefined): boolean {
    return typeof value === "string" && value.trim().length > 0
}

async function main() {
    const results: TestResult[] = []

    // Test 1: No access token should be rejected by auth middleware.
    console.log("Test 1: No token should be rejected...")
    results.push(await expectRejected("No token", undefined))

    // Test 2: Malformed/invalid token should be rejected by JWT verification.
    console.log("Test 2: Invalid token should be rejected...")
    results.push(await expectRejected("Invalid token", { accessToken: "fake-token" }))

    // Test 3: Valid signed access token should connect successfully.
    console.log("Test 3: Valid token should connect...")
    const token = await generateAccessToken({
        publicId: USER_PUBLIC_ID,
        sessionPublicId: SESSION_PUBLIC_ID,
    })
    results.push(await expectConnected("Valid token", { accessToken: token }))

    // Test 4: Expired token should be rejected by auth middleware
    console.log("Test 4: Expired token should be rejected...")
    const expiredToken = await generateTestAccessToken(USER_PUBLIC_ID, SESSION_PUBLIC_ID, "1s", authEnv.ACCESS_TOKEN_JWT_SECRET, authEnv.APP_URL, authEnv.APP_URL)
    await sleep(1200)
    results.push(await expectRejected("Expired token", { accessToken: expiredToken }, ["Unauthorized: TOKEN_EXPIRED"]))

    // Test 5: Wrong Issuer/audience
    // console.log("Test 5: Wrong Issuer/audience should be rejected...")
    // if (!hasNonEmptyValue(authEnv.APP_URL)) {
    //     results.push({
    //         name: "Wrong Issuer/audience",
    //         passed: false,
    //         details:
    //             "APP_URL is empty; issuer/audience validation is effectively disabled. Set APP_URL to a non-empty URL to validate this case.",
    //     })
    // } else {
    //     const wrongIssuerToken = await generateTestAccessToken(
    //         USER_PUBLIC_ID,
    //         SESSION_PUBLIC_ID,
    //         authEnv.ACCESS_TOKEN_EXPIRES_IN,
    //         authEnv.ACCESS_TOKEN_JWT_SECRET,
    //         "https://wrong-issuer.com",
    //         "https://wrong-audience.com"
    //     )
    //     results.push(await expectRejected("Wrong Issuer/audience", { accessToken: wrongIssuerToken }))
    // }

    // Test 6: Wrong secret
    console.log("Test 6: Wrong secret should be rejected...")
    const wrongSecretToken = await generateTestAccessToken(USER_PUBLIC_ID, SESSION_PUBLIC_ID, authEnv.ACCESS_TOKEN_EXPIRES_IN, "wrong-secret", authEnv.APP_URL, authEnv.APP_URL)
    results.push(await expectRejected("Wrong secret", { accessToken: wrongSecretToken }))

    // Test 7: Missing auth object
    console.log("Test 7: Missing auth object should be rejected...")    
    results.push(await expectRejected("Missing auth object", undefined))

    // Test 8: Missing access token
    console.log("Test 8: Missing access token should be rejected...")
    results.push(await expectRejected("Missing access token", {}))

    // Test 9: Non-string token types
    console.log("Test 9: Non-string token types should be rejected...")
    results.push(await expectRejected("Non-string token (number)", { accessToken: 123 }))
    results.push(await expectRejected("Non-string token (null)", { accessToken: null }))
    results.push(await expectRejected("Non-string token (undefined)", { accessToken: undefined }))
    results.push(await expectRejected("Non-string token (object)", { accessToken: { value: "token" } }))

    console.log("\n=== Results ===")
    for (const result of results) {
        const status = result.passed ? "PASS" : "FAIL"
        console.log(`${status} - ${result.name}: ${result.details}`)
    }

    const hasFailure = results.some((result) => !result.passed)
    process.exit(hasFailure ? 1 : 0)
}

main().catch((error) => {
    console.error("Unhandled test failure:", error)
        process.exit(1)
    })
