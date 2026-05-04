import { prisma } from "@prove-it/db"
import seedDocuments from "./seeds/documents"
import deleteDatabase from "./seeds/deleteDatabase"


async function main() {

    try {
        // Clear the database
        console.log("Deleting database...")
        await deleteDatabase()
        console.log("Database deleted")

        // Seed the database here
        console.log("Seeding database...")
        await seedDocuments()
        console.log("Seeding completed 🌱 ")

    } catch (error) {
        console.error(error)
        process.exitCode = 1
    } finally {
        await prisma.$disconnect().catch(() => {})
        process.exit(process.exitCode ?? 0)
    }
}

