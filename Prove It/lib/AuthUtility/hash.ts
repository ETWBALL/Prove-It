import bcrypt from 'bcrypt'
import { envSchema } from '@/lib/Validation/zodSchemas'

const { BCRYPT_SALT_ROUNDS } = envSchema.pick({ BCRYPT_SALT_ROUNDS: true }).parse({ BCRYPT_SALT_ROUNDS: process.env.BCRYPT_SALT_ROUNDS })

export async function hashPassword(password: string) {
    return await bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hashedPassword: string) {
    return await bcrypt.compare(password, hashedPassword)
}