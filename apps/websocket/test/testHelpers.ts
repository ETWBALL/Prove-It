import { prisma } from "@prove-it/db"
import type { Delta, DocumentState } from "../lib/types"
import { updateDatabase, validateDeltaForContent } from "../lib/helpers"

type Case = {
    name: string
    delta: Delta
    contentLength: number
    expected: string | null
}

function baseDelta(overrides: Partial<Delta> = {}): Delta {
    return {
        type: "insert",
        startIndex: 0,
        endIndex: 0,
        content: "x",
        documentId: "doc-1",
        revision: 1,
        ...overrides,
    }
}

async function main() {
    const cases: Case[] = [
        // Test 1: Valid delta should pass validation.
        {
            name: "valid insert returns null",
            delta: baseDelta(),
            contentLength: 10,
            expected: null,
        },

        // Test 2: Non-safe integers should fail shape validation.
        {
            name: "unsafe integer startIndex => INVALID_DELTA_SHAPE",
            delta: baseDelta({ startIndex: Number.MAX_SAFE_INTEGER + 1 }),
            contentLength: 10,
            expected: "INVALID_DELTA_SHAPE",
        },

        // Test 3: Non-positive revision should fail.
        {
            name: "revision <= 0 => INVALID_REVISION",
            delta: baseDelta({ revision: 0 }),
            contentLength: 10,
            expected: "INVALID_REVISION",
        },

        // Test 4: Negative indices should fail.
        {
            name: "negative index => INVALID_INDEX",
            delta: baseDelta({ startIndex: -1 }),
            contentLength: 10,
            expected: "INVALID_INDEX",
        },

        // Test 5: startIndex > endIndex should fail range validation.
        {
            name: "startIndex > endIndex => INVALID_RANGE",
            delta: baseDelta({ startIndex: 5, endIndex: 4 }),
            contentLength: 10,
            expected: "INVALID_RANGE",
        },

        // Test 6: Index exceeding content length should fail bounds check.
        {
            name: "index exceeds content length => INDEX_OUT_OF_BOUNDS",
            delta: baseDelta({ startIndex: 11, endIndex: 11 }),
            contentLength: 10,
            expected: "INDEX_OUT_OF_BOUNDS",
        },

        // Test 7: Non-string content should fail.
        {
            name: "non-string content => INVALID_CONTENT",
            delta: baseDelta({ content: 123 as unknown as string }),
            contentLength: 10,
            expected: "INVALID_CONTENT",
        },

        // Test 8: Oversized delta content should fail size guard.
        {
            name: "content > 50_000 chars => DELTA_TOO_LARGE",
            delta: baseDelta({ content: "a".repeat(50_001) }),
            contentLength: 10,
            expected: "DELTA_TOO_LARGE",
        },

        // Test 9: Insert with non-zero range should fail insert-range rule.
        {
            name: "insert with startIndex !== endIndex => INVALID_INSERT_RANGE",
            delta: baseDelta({ type: "insert", startIndex: 2, endIndex: 3 }),
            contentLength: 10,
            expected: "INVALID_INSERT_RANGE",
        },

        // Test 10: Next document length beyond max should fail.
        {
            name: "next length > 1_000_000 => DOCUMENT_SIZE_LIMIT",
            delta: baseDelta({ content: "abc" }),
            contentLength: 1_000_000,
            expected: "DOCUMENT_SIZE_LIMIT",
        },

        // Test 11: Unsupported delta.type currently has no explicit guard in validateDeltaForContent.
        // This captures current behavior (returns null), and will fail if you later add strict type validation.
        {
            name: "unsupported delta.type currently passes validation",
            delta: baseDelta({ type: "upsert" as Delta["type"] }),
            contentLength: 10,
            expected: null,
        },

        // Test 12: Additional non-string content type (array) should fail.
        {
            name: "array content => INVALID_CONTENT",
            delta: baseDelta({ content: ["x"] as unknown as string }),
            contentLength: 10,
            expected: "INVALID_CONTENT",
        },

        // Test 13: Additional non-string content type (object) should fail.
        {
            name: "object content => INVALID_CONTENT",
            delta: baseDelta({ content: { value: "x" } as unknown as string }),
            contentLength: 10,
            expected: "INVALID_CONTENT",
        },

        // Test 14: Additional non-string content type (boolean) should fail.
        {
            name: "boolean content => INVALID_CONTENT",
            delta: baseDelta({ content: true as unknown as string }),
            contentLength: 10,
            expected: "INVALID_CONTENT",
        },

        // Test 15: documentId type is currently not validated in this function.
        // This captures current behavior (returns null) and highlights a potential missing guard.
        {
            name: "non-string documentId currently passes validation",
            delta: baseDelta({ documentId: 123 as unknown as string }),
            contentLength: 10,
            expected: null,
        },

        // Test 16: Negative revision should fail.
        {
            name: "negative revision => INVALID_REVISION",
            delta: baseDelta({ revision: -1 }),
            contentLength: 10,
            expected: "INVALID_REVISION",
        },
    ]

    const validationResults = cases.map((test) => {
        const got = validateDeltaForContent(test.delta, test.contentLength)
        const passed = got === test.expected
        return { name: test.name, passed, expected: test.expected, got }
    })

    console.log("\n=== validateDeltaForContent Tests ===")
    for (const r of validationResults) {
        const status = r.passed ? "✅PASS" : "❌FAIL"
        console.log(`${status} - ${r.name}: expected=${String(r.expected)} got=${String(r.got)}`)
    }

    const updateDbResults: Array<{ name: string; passed: boolean; details: string }> = []
    const seededDocument = await prisma.document.findFirst({
        where: { title: "Test Document", deletedAt: null },
        orderBy: { createdAt: "asc" },
    })
    if (!seededDocument) {
        console.error("No seeded 'Test Document' found. Run `pnpm prisma:seed` first.")
        process.exit(1)
    }
    const DOCUMENT_PUBLIC_ID = seededDocument.publicId

    function baseDocState(overrides: Partial<DocumentState> = {}): DocumentState {
        return {
            questionContent: "",
            questionRevision: 0,
            questionBuffer: [],
            content: "Updated test content",
            contentId: "placeholder-content-id",
            revision: 1,
            buffer: [
                {
                    type: "insert",
                    startIndex: 0,
                    endIndex: 0,
                    content: "Updated ",
                    documentId: DOCUMENT_PUBLIC_ID,
                    revision: 1,
                },
            ],
            errors: [],
            // Required fields on ``DocumentState`` — keep null so the tests don't depend on
            // course/proof-type/math-statement state they don't seed.
            coursePublicId: null,
            proofType: null,
            selectedMathStatements: null,
            ...overrides,
        }
    }

    console.log("\n=== updateDatabase Tests ===")

    // Test U1: Non-existent documentPublicId should throw.
    try {
        const map = new Map<string, DocumentState>()
        await updateDatabase("does-not-exist-document-id", baseDocState(), map, true)
        updateDbResults.push({
            name: "U1 non-existent documentPublicId throws",
            passed: false,
            details: "Expected throw, but function resolved.",
        })
    } catch {
        updateDbResults.push({
            name: "U1 non-existent documentPublicId throws",
            passed: true,
            details: "Threw as expected.",
        })
    }

    // Test U2: clearBuffer=true should clear buffer in in-memory map after DB persist.
    try {
        const map = new Map<string, DocumentState>()
        const state = baseDocState({
            content: "U2 content",
            revision: 2,
            buffer: [
                {
                    type: "insert",
                    startIndex: 0,
                    endIndex: 0,
                    content: "U2",
                    documentId: DOCUMENT_PUBLIC_ID,
                    revision: 2,
                },
            ],
        })

        await updateDatabase(DOCUMENT_PUBLIC_ID, state, map, true)
        const updated = map.get(DOCUMENT_PUBLIC_ID)
        const doc = await prisma.document.findUnique({
            where: { publicId: DOCUMENT_PUBLIC_ID },
            include: { documentBody: true },
        })

        const passed =
            !!updated &&
            updated.buffer.length === 0 &&
            updated.content === state.content &&
            !!doc?.documentBody &&
            doc.documentBody.content === state.content

        updateDbResults.push({
            name: "U2 clearBuffer=true clears in-memory buffer and persists content",
            passed,
            details: passed
                ? "Map buffer cleared and DB content updated."
                : `Unexpected state: map=${JSON.stringify(updated)} dbContent=${doc?.documentBody?.content}`,
        })
    } catch (error) {
        updateDbResults.push({
            name: "U2 clearBuffer=true clears in-memory buffer and persists content",
            passed: false,
            details: String(error),
        })
    }

    // Test U3: clearBuffer=false should keep buffer in in-memory map after DB persist.
    try {
        const map = new Map<string, DocumentState>()
        const state = baseDocState({
            content: "U3 content",
            revision: 3,
            buffer: [
                {
                    type: "insert",
                    startIndex: 0,
                    endIndex: 0,
                    content: "U3",
                    documentId: DOCUMENT_PUBLIC_ID,
                    revision: 3,
                },
            ],
        })

        await updateDatabase(DOCUMENT_PUBLIC_ID, state, map, false)
        const updated = map.get(DOCUMENT_PUBLIC_ID)
        const passed =
            !!updated &&
            updated.buffer.length === state.buffer.length &&
            updated.buffer[0]?.content === state.buffer[0]?.content

        updateDbResults.push({
            name: "U3 clearBuffer=false retains in-memory buffer",
            passed,
            details: passed
                ? "Map buffer retained as expected."
                : `Unexpected map state: ${JSON.stringify(updated)}`,
        })
    } catch (error) {
        updateDbResults.push({
            name: "U3 clearBuffer=false retains in-memory buffer",
            passed: false,
            details: String(error),
        })
    }

    // Test U4: Invalid updatedDocState shape should throw.
    try {
        const map = new Map<string, DocumentState>()
        const invalidState = {
            revision: 1,
            buffer: [],
            errors: [],
        } as unknown as DocumentState

        await updateDatabase(DOCUMENT_PUBLIC_ID, invalidState, map, true)
        updateDbResults.push({
            name: "U4 invalid updatedDocState throws",
            passed: false,
            details: "Expected throw, but function resolved.",
        })
    } catch {
        updateDbResults.push({
            name: "U4 invalid updatedDocState throws",
            passed: true,
            details: "Threw as expected.",
        })
    }

    // Test U5: Existing unrelated map entries should remain while target key gets updated.
    try {
        const map = new Map<string, DocumentState>()
        map.set("unrelated-doc", baseDocState({ content: "unrelated", revision: 99 }))
        const state = baseDocState({ content: "U5 content", revision: 5 })

        await updateDatabase(DOCUMENT_PUBLIC_ID, state, map, true)
        const unrelatedStillThere = map.has("unrelated-doc")
        const targetUpdated = map.has(DOCUMENT_PUBLIC_ID)
        const passed = unrelatedStillThere && targetUpdated

        updateDbResults.push({
            name: "U5 unrelated map entries remain intact",
            passed,
            details: passed
                ? "Target document updated without removing unrelated map keys."
                : `Map keys after update: ${JSON.stringify(Array.from(map.keys()))}`,
        })
    } catch (error) {
        updateDbResults.push({
            name: "U5 unrelated map entries remain intact",
            passed: false,
            details: String(error),
        })
    }

    // Test U6: If one error update fails, transaction should rollback DB content update.
    try {
        const map = new Map<string, DocumentState>()
        const before = await prisma.document.findUnique({
            where: { publicId: DOCUMENT_PUBLIC_ID },
            include: { documentBody: true },
        })
        const beforeContent = before?.documentBody?.content ?? null

        const state = baseDocState({
            content: "U6 should rollback this content",
            revision: 6,
            errors: [
                {
                    publicId: "missing-error-public-id",
                    startIndexError: 0,
                    endIndexError: 1,
                    errorMessage: "x",
                    errortype: "INFORMAL_LANGUAGE",
                    suggestion: undefined,
                    resolvedAt: null,
                    dismissedAt: null,
                },
            ],
        })

        let threw = false
        try {
            await updateDatabase(DOCUMENT_PUBLIC_ID, state, map, true)
        } catch {
            threw = true
        }

        const after = await prisma.document.findUnique({
            where: { publicId: DOCUMENT_PUBLIC_ID },
            include: { documentBody: true },
        })
        const afterContent = after?.documentBody?.content ?? null

        const passed = threw && beforeContent === afterContent
        updateDbResults.push({
            name: "U6 rollback when error row update fails",
            passed,
            details: passed
                ? "Function threw and documentBody content remained unchanged."
                : `Unexpected rollback behavior: threw=${threw} before=${beforeContent} after=${afterContent}`,
        })
    } catch (error) {
        updateDbResults.push({
            name: "U6 rollback when error row update fails",
            passed: false,
            details: String(error),
        })
    }

    // Test U7: Malformed suggestion index types should fail validation at Prisma layer
    // even when the target error row exists.
    try {
        const map = new Map<string, DocumentState>()
        const existingError = await prisma.error.findFirst({
            where: {
                document: { publicId: DOCUMENT_PUBLIC_ID },
            },
            orderBy: { createdAt: "asc" },
        })

        if (!existingError) {
            throw new Error("No seeded error rows found for target document.")
        }

        const state = baseDocState({
            content: "U7 malformed suggestion types",
            revision: 7,
            errors: [
                {
                    publicId: existingError.publicId,
                    startIndexError: 0,
                    endIndexError: 1,
                    errorMessage: "x",
                    errortype: "INFORMAL_LANGUAGE",
                    suggestion: {
                        suggestionContent: "bad",
                        startIndexSuggestion: "abc" as unknown as number,
                        endIndexSuggestion: 3,
                    },
                    resolvedAt: null,
                    dismissedAt: null,
                },
            ],
        })

        await updateDatabase(DOCUMENT_PUBLIC_ID, state, map, true)
        updateDbResults.push({
            name: "U7 malformed suggestion types throw",
            passed: false,
            details: "Expected throw, but function resolved.",
        })
    } catch {
        updateDbResults.push({
            name: "U7 malformed suggestion types throw",
            passed: true,
            details: "Threw as expected.",
        })
    }

    // Test U8: Large content should persist successfully (smoke test for large payload path).
    try {
        const map = new Map<string, DocumentState>()
        const largeContent = "L".repeat(200_000)
        const state = baseDocState({
            content: largeContent,
            revision: 8,
            errors: [],
            buffer: [],
        })

        await updateDatabase(DOCUMENT_PUBLIC_ID, state, map, true)
        const doc = await prisma.document.findUnique({
            where: { publicId: DOCUMENT_PUBLIC_ID },
            include: { documentBody: true },
        })
        const persisted = doc?.documentBody?.content ?? ""
        const updated = map.get(DOCUMENT_PUBLIC_ID)
        const passed = persisted.length === largeContent.length && updated?.content.length === largeContent.length

        updateDbResults.push({
            name: "U8 large content persists",
            passed,
            details: passed
                ? `Persisted large content length=${largeContent.length}.`
                : `Length mismatch persisted=${persisted.length} map=${updated?.content.length ?? -1}`,
        })
    } catch (error) {
        updateDbResults.push({
            name: "U8 large content persists",
            passed: false,
            details: String(error),
        })
    }

    // Test U9: Concurrent updates on same document should not corrupt DB (final content is one submitted value).
    try {
        const mapA = new Map<string, DocumentState>()
        const mapB = new Map<string, DocumentState>()
        const stateA = baseDocState({ content: "U9-A content", revision: 9, errors: [], buffer: [] })
        const stateB = baseDocState({ content: "U9-B content", revision: 10, errors: [], buffer: [] })

        const settled = await Promise.allSettled([
            updateDatabase(DOCUMENT_PUBLIC_ID, stateA, mapA, true),
            updateDatabase(DOCUMENT_PUBLIC_ID, stateB, mapB, true),
        ])

        const rejected = settled.some((r) => r.status === "rejected")
        const doc = await prisma.document.findUnique({
            where: { publicId: DOCUMENT_PUBLIC_ID },
            include: { documentBody: true },
        })
        const persisted = doc?.documentBody?.content ?? ""
        const passed = !rejected && (persisted === stateA.content || persisted === stateB.content)

        updateDbResults.push({
            name: "U9 concurrent writes stay consistent",
            passed,
            details: passed
                ? `Concurrent writes completed; final content="${persisted}".`
                : `Unexpected concurrent result: rejected=${rejected} persisted="${persisted}"`,
        })
    } catch (error) {
        updateDbResults.push({
            name: "U9 concurrent writes stay consistent",
            passed: false,
            details: String(error),
        })
    }

    // Test U10: Re-running with clearBuffer=true is idempotent for buffer and map shape.
    try {
        const map = new Map<string, DocumentState>()
        const state = baseDocState({
            content: "U10 idempotent content",
            revision: 11,
            errors: [],
            buffer: [
                {
                    type: "insert",
                    startIndex: 0,
                    endIndex: 0,
                    content: "U10",
                    documentId: DOCUMENT_PUBLIC_ID,
                    revision: 11,
                },
            ],
        })

        await updateDatabase(DOCUMENT_PUBLIC_ID, state, map, true)
        await updateDatabase(
            DOCUMENT_PUBLIC_ID,
            { ...state, revision: 12, buffer: [] },
            map,
            true
        )

        const updated = map.get(DOCUMENT_PUBLIC_ID)
        const passed = !!updated && updated.buffer.length === 0 && updated.content === state.content

        updateDbResults.push({
            name: "U10 clearBuffer=true idempotent across repeated writes",
            passed,
            details: passed
                ? "Repeated writes kept buffer empty and content stable."
                : `Unexpected map state: ${JSON.stringify(updated)}`,
        })
    } catch (error) {
        updateDbResults.push({
            name: "U10 clearBuffer=true idempotent across repeated writes",
            passed: false,
            details: String(error),
        })
    }

    // Test U11: Real existing error row should be updated successfully (happy path).
    try {
        const map = new Map<string, DocumentState>()
        const existingError = await prisma.error.findFirst({
            where: { document: { publicId: DOCUMENT_PUBLIC_ID } },
            orderBy: { createdAt: "asc" },
        })
        if (!existingError) throw new Error("No seeded error row found.")

        const nextStart = existingError.startIndexError + 1
        const nextEnd = Math.max(nextStart + 1, existingError.endIndexError + 1)
        const nextSuggestionContent = "Updated suggestion content for U11"

        const state = baseDocState({
            content: "U11 content with real error update",
            revision: 13,
            buffer: [],
            errors: [
                {
                    publicId: existingError.publicId,
                    startIndexError: nextStart,
                    endIndexError: nextEnd,
                    errorMessage: existingError.errorMessage,
                    errortype: existingError.errortype,
                    suggestion: {
                        suggestionContent: nextSuggestionContent,
                        startIndexSuggestion: 3,
                        endIndexSuggestion: 19,
                    },
                    resolvedAt: null,
                    dismissedAt: null,
                },
            ],
        })

        await updateDatabase(DOCUMENT_PUBLIC_ID, state, map, true)
        const updatedError = await prisma.error.findUnique({ where: { publicId: existingError.publicId } })
        const passed =
            !!updatedError &&
            updatedError.startIndexError === nextStart &&
            updatedError.endIndexError === nextEnd &&
            updatedError.suggestionContent === nextSuggestionContent &&
            updatedError.startIndexSuggestion === 3 &&
            updatedError.endIndexSuggestion === 19

        updateDbResults.push({
            name: "U11 real error row updates persisted",
            passed,
            details: passed
                ? "Error indices and suggestion fields updated in DB."
                : `Unexpected error row: ${JSON.stringify(updatedError)}`,
        })
    } catch (error) {
        updateDbResults.push({
            name: "U11 real error row updates persisted",
            passed: false,
            details: String(error),
        })
    }

    // Test U12: updateDatabase should create a new ProofAttempt row.
    try {
        const map = new Map<string, DocumentState>()
        const doc = await prisma.document.findUnique({
            where: { publicId: DOCUMENT_PUBLIC_ID },
            select: { privateId: true },
        })
        if (!doc) throw new Error("Seeded document missing.")
        const beforeCount = await prisma.proofAttempt.count({
            where: { privateDocumentId: doc.privateId },
        })

        const state = baseDocState({
            content: "U12 content proofAttempt check",
            revision: 14,
            buffer: [],
            errors: [],
        })
        await updateDatabase(DOCUMENT_PUBLIC_ID, state, map, true)

        const afterCount = await prisma.proofAttempt.count({
            where: { privateDocumentId: doc.privateId },
        })
        const passed = afterCount === beforeCount + 1
        updateDbResults.push({
            name: "U12 proofAttempt row created per update",
            passed,
            details: passed
                ? `proofAttempt count increased from ${beforeCount} to ${afterCount}.`
                : `Unexpected proofAttempt count delta: before=${beforeCount} after=${afterCount}`,
        })
    } catch (error) {
        updateDbResults.push({
            name: "U12 proofAttempt row created per update",
            passed: false,
            details: String(error),
        })
    }

    // Test U13: In-memory contentId should match persisted documentBody.publicId.
    try {
        const map = new Map<string, DocumentState>()
        const state = baseDocState({
            content: "U13 contentId linkage check",
            revision: 15,
            buffer: [],
            errors: [],
        })
        await updateDatabase(DOCUMENT_PUBLIC_ID, state, map, true)
        const updatedMapState = map.get(DOCUMENT_PUBLIC_ID)
        const doc = await prisma.document.findUnique({
            where: { publicId: DOCUMENT_PUBLIC_ID },
            include: { documentBody: true },
        })

        const passed =
            !!updatedMapState &&
            !!doc?.documentBody &&
            updatedMapState.contentId === doc.documentBody.publicId
        updateDbResults.push({
            name: "U13 map.contentId matches persisted documentBody.publicId",
            passed,
            details: passed
                ? "contentId linkage is correct."
                : `Mismatch mapContentId=${updatedMapState?.contentId} dbContentId=${doc?.documentBody?.publicId}`,
        })
    } catch (error) {
        updateDbResults.push({
            name: "U13 map.contentId matches persisted documentBody.publicId",
            passed: false,
            details: String(error),
        })
    }

    // Test U14: document.lastEdited should move forward after update.
    try {
        const before = await prisma.document.findUnique({
            where: { publicId: DOCUMENT_PUBLIC_ID },
            select: { lastEdited: true },
        })
        await new Promise((resolve) => setTimeout(resolve, 5))

        const map = new Map<string, DocumentState>()
        const state = baseDocState({
            content: "U14 lastEdited monotonic check",
            revision: 16,
            buffer: [],
            errors: [],
        })
        await updateDatabase(DOCUMENT_PUBLIC_ID, state, map, true)

        const after = await prisma.document.findUnique({
            where: { publicId: DOCUMENT_PUBLIC_ID },
            select: { lastEdited: true },
        })
        const beforeMs = before?.lastEdited?.getTime() ?? 0
        const afterMs = after?.lastEdited?.getTime() ?? 0
        const passed = afterMs >= beforeMs
        updateDbResults.push({
            name: "U14 document.lastEdited is monotonic",
            passed,
            details: passed
                ? `lastEdited moved from ${beforeMs} to ${afterMs}.`
                : `Unexpected lastEdited regression: before=${beforeMs} after=${afterMs}`,
        })
    } catch (error) {
        updateDbResults.push({
            name: "U14 document.lastEdited is monotonic",
            passed: false,
            details: String(error),
        })
    }

    // Test U15: suggestion transition null -> populated -> null persists correctly on same error row.
    try {
        const existingError = await prisma.error.findFirst({
            where: { document: { publicId: DOCUMENT_PUBLIC_ID } },
            orderBy: { createdAt: "asc" },
        })
        if (!existingError) throw new Error("No seeded error row found.")

        const map1 = new Map<string, DocumentState>()
        const state1 = baseDocState({
            content: "U15 transition step 1",
            revision: 17,
            buffer: [],
            errors: [
                {
                    publicId: existingError.publicId,
                    startIndexError: existingError.startIndexError,
                    endIndexError: existingError.endIndexError,
                    errorMessage: existingError.errorMessage,
                    errortype: existingError.errortype,
                    suggestion: undefined,
                    resolvedAt: null,
                    dismissedAt: null,
                },
            ],
        })
        await updateDatabase(DOCUMENT_PUBLIC_ID, state1, map1, true)

        const map2 = new Map<string, DocumentState>()
        const state2 = baseDocState({
            content: "U15 transition step 2",
            revision: 18,
            buffer: [],
            errors: [
                {
                    publicId: existingError.publicId,
                    startIndexError: existingError.startIndexError,
                    endIndexError: existingError.endIndexError,
                    errorMessage: existingError.errorMessage,
                    errortype: existingError.errortype,
                    suggestion: {
                        suggestionContent: "Now add a concrete suggestion",
                        startIndexSuggestion: 4,
                        endIndexSuggestion: 24,
                    },
                    resolvedAt: null,
                    dismissedAt: null,
                },
            ],
        })
        await updateDatabase(DOCUMENT_PUBLIC_ID, state2, map2, true)

        const map3 = new Map<string, DocumentState>()
        const state3 = baseDocState({
            content: "U15 transition step 3",
            revision: 19,
            buffer: [],
            errors: [
                {
                    publicId: existingError.publicId,
                    startIndexError: existingError.startIndexError,
                    endIndexError: existingError.endIndexError,
                    errorMessage: existingError.errorMessage,
                    errortype: existingError.errortype,
                    suggestion: undefined,
                    resolvedAt: null,
                    dismissedAt: null,
                },
            ],
        })
        await updateDatabase(DOCUMENT_PUBLIC_ID, state3, map3, true)

        const finalError = await prisma.error.findUnique({
            where: { publicId: existingError.publicId },
        })
        const passed = !!finalError && finalError.suggestionContent === null
        updateDbResults.push({
            name: "U15 suggestion null/populated transitions persist",
            passed,
            details: passed
                ? "Final suggestionContent is null after null->populated->null transitions."
                : `Unexpected final suggestion state: ${JSON.stringify(finalError)}`,
        })
    } catch (error) {
        updateDbResults.push({
            name: "U15 suggestion null/populated transitions persist",
            passed: false,
            details: String(error),
        })
    }

    for (const r of updateDbResults) {
        const status = r.passed ? "✅PASS" : "❌FAIL"
        console.log(`${status} - ${r.name}: ${r.details}`)
    }

    const hasValidationFailure = validationResults.some((r) => !r.passed)
    const hasUpdateDbFailure = updateDbResults.some((r) => !r.passed)
    process.exit(hasValidationFailure || hasUpdateDbFailure ? 1 : 0)
}

main().catch((error) => {
    console.error("Unhandled test failure:", error)
    process.exit(1)
})

