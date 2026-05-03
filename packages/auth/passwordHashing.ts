import { createHash } from 'node:crypto'
import bcrypt from 'bcrypt'
import { authEnv } from './lib/envSchema'

const { BCRYPT_SALT_ROUNDS } = authEnv

export async function hashPassword(password: string) {
    return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)
}

export async function verifyPassword(password: string, hashedPassword: string) {
    return await bcrypt.compare(password, hashedPassword)
}

/** SHA-256 hex then bcrypt so long JWTs are not truncated by bcrypt’s 72-byte input limit. */
export async function hashOpaqueToken(token: string) {
    const digest = createHash('sha256').update(token, 'utf8').digest('hex')
    return bcrypt.hash(digest, BCRYPT_SALT_ROUNDS)
}

export async function verifyOpaqueToken(token: string, hashed: string) {
    const digest = createHash('sha256').update(token, 'utf8').digest('hex')
    return bcrypt.compare(digest, hashed)
}