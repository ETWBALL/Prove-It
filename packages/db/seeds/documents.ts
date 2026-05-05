import { prisma, type Document } from "../index"




/**
 * Seed the database with documents
 * @param courseId The ID of the course to seed the documents for
 */
export default async function seedDocuments(ownerId: number, courseId: number, title: string, content: string): Promise<Document | null> {
    try {
        const document = await prisma.document.create({
            data: {
                title: title,
                privateOwnerId: ownerId,
                privateCourseId: courseId,
                proofType: 'DIRECT',
                documentBody:{
                    create: {
                        content: content,
                    }
                }
            }
        })
        
        console.log(`${document.title} seeded 📄 `);

        return document 

    } catch (error) {
        console.error(error)
        return null
    }
}