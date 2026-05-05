import { prisma } from "./index"
import seedDocuments from "./seeds/documents"
import deleteDatabase from "./seeds/deleteDatabase"
import seedUniversity from "./seeds/university"
import seedCourse from "./seeds/course"
import seedUser from "./seeds/user"
import seedErrors from "./seeds/error"


async function main() {

    try {
        // Clear the database
        console.log("Deleting database...")
        await deleteDatabase()
        console.log("Database deleted")

        // Seed the database here
        const university = await seedUniversity()
        const course = await seedCourse(university?.privateId ?? 1)
        const user = await seedUser('Test User', 'test@utoronto.ca', 'password123')

        const doc1Content =
            "Let x be an integer. Since x is even, x = 2k. This clearly works."
        const doc2Content =
            "Let y be an integer. if y is odd, then y = 2k + 1. Hence done."

        const doc1 = await seedDocuments(
            user?.privateId ?? 1,
            course?.privateId ?? 1,
            "Test Document",
            doc1Content
        )
        const doc2 = await seedDocuments(
            user?.privateId ?? 1,
            course?.privateId ?? 1,
            "Test Document 2",
            doc2Content
        )

        if (doc1) {
            await seedErrors(doc1.privateId, doc1Content)
        }
        if (doc2) {
            await seedErrors(doc2.privateId, doc2Content)
        }

        console.log("Seeding completed 🌱 ")

    } catch (error) {
        console.error(error)
        process.exitCode = 1
    } finally {
        await prisma.$disconnect().catch(() => {})
        process.exit(process.exitCode ?? 0)
        console.error("Something went wrong, did you forget to run you database?")

    }
}

main()

