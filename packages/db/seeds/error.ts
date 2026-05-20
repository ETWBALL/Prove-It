import { prisma, type Error as DbError } from "../index"
import type { ErrorType, ValidationLayer } from "../generated/prisma"

type ErrorSeedInput = {
    anchor: string
    // Renamed Prisma field: DB column is still ``errorContent`` (via @map); client surface is ``errorMessage``.
    errorMessage: string
    suggestionContent: string | null
    suggestionStart: number
    suggestionEnd: number
    errortype: Extract<ErrorType, "IMPLICIT_ASSUMPTION" | "INFORMAL_LANGUAGE" | "ASSUMING_THE_CONVERSE" | "INCOMPLETE_SENTENCE">
    layer: ValidationLayer
}

function buildErrorSeedsForContent(content: string): ErrorSeedInput[] {
    // Keep these anchors in-order and non-overlapping in the seeded proof text.
    if (content.includes("x = 2k")) {
        return [
            {
                anchor: "x = 2k",
                errorMessage: "Missing justification for introducing k",
                suggestionContent: "By definition of even, there exists an integer k such that x = 2k.",
                suggestionStart: 2,
                suggestionEnd: 28,
                // ``MISSING_JUSTIFICATION`` was removed from the ErrorType enum; closest current match.
                errortype: "IMPLICIT_ASSUMPTION",
                layer: "LOGIC_CHAIN",
            },
            {
                anchor: "This clearly works.",
                errorMessage: "Informal phrasing weakens proof rigor",
                suggestionContent: null,
                suggestionStart: 0,
                suggestionEnd: 1,
                errortype: "INFORMAL_LANGUAGE",
                layer: "PROOF_GRAMMER",
            },
        ]
    }

    return [
        {
            anchor: "if y is odd",
            errorMessage: "Assuming converse without proof",
            suggestionContent: "Use the odd definition directly: y = 2k + 1 for some integer k.",
            suggestionStart: 5,
            suggestionEnd: 35,
            errortype: "ASSUMING_THE_CONVERSE",
            layer: "LOGIC_CHAIN",
        },
        {
            anchor: "Hence done",
            errorMessage: "Conclusion sentence is incomplete",
            suggestionContent: "Hence, the proposition is proven by direct construction.",
            suggestionStart: 0,
            suggestionEnd: 22,
            errortype: "INCOMPLETE_SENTENCE",
            layer: "PROOF_GRAMMER",
        },
    ]
}

export default async function seedErrors(
    privateDocumentId: number,
    content: string
): Promise<DbError[]> {
    try {
        const seeds = buildErrorSeedsForContent(content)
        const created: DbError[] = []

        for (const seed of seeds) {
            const startIndexError = content.indexOf(seed.anchor)
            if (startIndexError < 0) {
                throw new Error(`Anchor "${seed.anchor}" not found in seeded content.`)
            }
            const endIndexError = startIndexError + seed.anchor.length

            const errorRow = await prisma.error.create({
                data: {
                    startIndexError,
                    endIndexError,
                    errorMessage: seed.errorMessage,
                    problematicContent: seed.anchor,
                    suggestionContent: seed.suggestionContent,
                    startIndexSuggestion: seed.suggestionStart,
                    endIndexSuggestion: seed.suggestionEnd,
                    privateDocumentId,
                    errortype: seed.errortype,
                    layer: seed.layer,
                },
            })

            created.push(errorRow)
        }

        console.log(`Seeded ${created.length} errors for document ${privateDocumentId} ❗`)
        return created
    } catch (error) {
        console.error("Failed to seed errors:", error)
        return []
    }
}