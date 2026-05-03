// packages/db/index.ts
export * from './generated/prisma'
export { PrismaClientKnownRequestError } from './generated/prisma/runtime/library'
import { PrismaClient } from './generated/prisma'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}