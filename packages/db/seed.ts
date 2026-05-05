import { prisma } from "./index"
import seedDocuments from "./seeds/documents"
import deleteDatabase from "./seeds/deleteDatabase"
import seedUniversity from "./seeds/university"
import seedCourse from "./seeds/course"
import seedUser from "./seeds/user"


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
        await seedDocuments(user?.privateId ?? 1, course?.privateId ?? 1, 'Test Document', 'Let x be an integer. Since x is even, x = 2k')
        await seedDocuments(user?.privateId ?? 1, course?.privateId ?? 1, 'Test Document 2', 'Let y be an integer. Since y is odd, y = 2k + 1')
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

