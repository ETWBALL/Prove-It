import { prisma, University } from "../index"

/**
 * Seed the database with a university
 * @returns The seeded university
 */
export default async function seedUniversity(): Promise<University | null> {
    try {
        const university = await prisma.university.create({
            data: {
                name: 'University of Toronto',
                country: 'CANADA',
                emailDomains: {
                    create: { domain: 'utoronto.ca' }
                }
            }
        })
        console.log(`${university.name} seeded 🎓 `)
        return university


    } catch (error) {
        console.error(error)
        return null
    }
}