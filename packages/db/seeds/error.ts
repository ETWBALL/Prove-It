import { prisma, type Error as DbError } from "../index"

type ErrorSeedInput = {
    anchor: string
    errorContent: string
    suggestionContent: string | null
    suggestionStart: number
    suggestionEnd: number
    type: "MISSING_JUSTIFICATION" | "INFORMAL_LANGUAGE" | "ASSUMING_THE_CONVERSE" | "INCOMPLETE_SENTENCE"
}

function buildErrorSeedsForContent(content: string): ErrorSeedInput[] {
    // Keep these anchors in-order and non-overlapping in the seeded proof text.
    if (content.includes("x = 2k")) {
        return [
            {
                anchor: "x = 2k",
                errorContent: "Missing justification for introducing k",
                suggestionContent: "By definition of even, there exists an integer k such that x = 2k.",
                suggestionStart: 2,
                suggestionEnd: 28,
                type: "MISSING_JUSTIFICATION",
            },
            {
                anchor: "This clearly works.",
                errorContent: "Informal phrasing weakens proof rigor",
                suggestionContent: null,
                suggestionStart: 0,
                suggestionEnd: 1,
                type: "INFORMAL_LANGUAGE",
            },
        ]
    }

    return [
        {
            anchor: "if y is odd",
            errorContent: "Assuming converse without proof",
            suggestionContent: "Use the odd definition directly: y = 2k + 1 for some integer k.",
            suggestionStart: 5,
            suggestionEnd: 35,
            type: "ASSUMING_THE_CONVERSE",
        },
        {
            anchor: "Hence done",
            errorContent: "Conclusion sentence is incomplete",
            suggestionContent: "Hence, the proposition is proven by direct construction.",
            suggestionStart: 0,
            suggestionEnd: 22,
            type: "INCOMPLETE_SENTENCE",
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
                    errorContent: seed.errorContent,
                    suggestionContent: seed.suggestionContent,
                    startIndexSuggestion: seed.suggestionStart,
                    endIndexSuggestion: seed.suggestionEnd,
                    privateDocumentId,
                    type: seed.type,
                    layer: "LOGIC_CHAIN",
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