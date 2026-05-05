import { Course, prisma } from "../index"


/**
 * Seed the database with a course
 * @param universityId The ID of the university to seed the course for
 * @returns The seeded course
 */
export default async function seedCourse(universityId: number): Promise<Course | null> {
    try {
        const course = await prisma.course.create({
            data: {
                name: 'MATH 101',
                universityId: universityId,
            }
        })
        console.log(`${course.name} Course seeded 📚 `)
        return course

    } catch (error) {
        console.error(error)
        return null
    }
}