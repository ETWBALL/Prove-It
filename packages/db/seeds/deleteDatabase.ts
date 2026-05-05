import { prisma } from "../index"

export default async function deleteDatabase() {
    // 1. Delete Junction Tables first (they depend on multiple models)
    await prisma.documentMathStatements.deleteMany()

    // 2. Delete "Child" models that reference Documents/Users
    await prisma.error.deleteMany()
    await prisma.hint.deleteMany()
    await prisma.proofAttempt.deleteMany()
    await prisma.documentBody.deleteMany()
    await prisma.sessions.deleteMany()
    await prisma.oAuthAccount.deleteMany()
    await prisma.dailyUsage.deleteMany()
    await prisma.subscription.deleteMany()

    // 3. Delete "Parent" content models
    await prisma.document.deleteMany()
    await prisma.mathStatement.deleteMany()
    await prisma.userCourse.deleteMany() // Enrollment junction

    // 4. Delete "Root" University context
    await prisma.course.deleteMany()
    await prisma.universityDomain.deleteMany()
    await prisma.university.deleteMany()

    // 5. Delete global system models
    await prisma.user.deleteMany()
    await prisma.plan.deleteMany()
}