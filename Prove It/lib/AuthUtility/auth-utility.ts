import { SignJWT, errors, jwtVerify } from "jose";
import { env } from "@/lib/Validation/zodSchemas";
import type { UserModel } from '@/app/generated/prisma/models/User'
import type { SessionsModel } from '@/app/generated/prisma/models/Sessions'


// ACCESS TOKEN GENERATION: Returns a new token with payload and expiry time
export async function generateAccessToken(payload: { publicId: UserModel['publicId'] , sessionPublicId: SessionsModel['publicId'] }){
    return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(env.APP_URL)        
    .setAudience(env.APP_URL)  
    .setExpirationTime(env.ACCESS_TOKEN_EXPIRES_IN)
    .sign(new TextEncoder().encode(env.ACCESS_TOKEN_JWT_SECRET));
} 


// ACCESS TOKEN VERIFICATION: If token valid, return payload. If invalid, return null
export async function verifyAccessToken(token: string){
    try {
        const result = await jwtVerify(token, new TextEncoder().encode(env.ACCESS_TOKEN_JWT_SECRET), {
            issuer: env.APP_URL,
            audience: env.APP_URL,
        });

        return { valid: true, expired: false, invalid: false, payload: result.payload }
    } catch (error) {
        if (error instanceof errors.JWTExpired) {
            return { valid: false, expired: true, invalid: false, payload: null }
        }
        if (error instanceof errors.JWSInvalid) {
            return { valid: false, expired: false, invalid: true, payload: null }
        }
        return { valid: false, expired: false, invalid: true, payload: null}
    }
}

// REFRESH TOKEN GENERATION: Returns a new token with payload and expiry time
export async function generateRefreshToken(payload: { publicId: UserModel['publicId'] , sessionPublicId: SessionsModel['publicId'] }){
    return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(env.NEXT_PUBLIC_APP_URL)        
    .setAudience(env.NEXT_PUBLIC_APP_URL)  
    .setExpirationTime(env.REFRESH_TOKEN_EXPIRES_IN)
    .sign(new TextEncoder().encode(env.REFRESH_TOKEN_JWT_SECRET));
} 

// REFRESH TOKEN VERIFICATION: If token valid, return payload. If invalid, return null
export async function verifyRefreshToken(token: string){
    try {
        const result = await jwtVerify(token, new TextEncoder().encode(env.REFRESH_TOKEN_JWT_SECRET), {
            issuer: env.NEXT_PUBLIC_APP_URL,
            audience: env.NEXT_PUBLIC_APP_URL,
        });
        return { valid: true, expired: false, invalid: false, payload: result.payload }
        
    } catch (error) {
        if (error instanceof errors.JWTExpired) {
            return { valid: false, expired: true, invalid: false, payload: null }
        }
        if (error instanceof errors.JWSInvalid) {
            return { valid: false, expired: false, invalid: true, payload: null }
        }
        return { valid: false, expired: false, invalid: true, payload: null}
    }
}