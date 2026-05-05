import { prisma, User } from "../index"

/**
 * Seed the database with a user
 * @param email The email of the user
 * @param password The password of the user
 * @returns The seeded user
 */
export default async function seedUser(name: string, email: string, password: string): Promise<User | null> {
    try {
        const user = await prisma.user.create({
            data: {
                name: name,
                email: email,
                password: password,
                sessions: {
                    create: {
                        device: 'Nokia 3310',
                        tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
                        lastActiveAt: new Date(),
                    }
                }
            }
        })
        console.log(`User ${user.name} seeded 🧑 `)
        return user

    } catch (error) {
        console.error(error)
        return null
    }
}