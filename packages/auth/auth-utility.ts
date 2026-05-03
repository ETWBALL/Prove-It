import { SignJWT, errors, jwtVerify } from "jose";
import { authEnv } from "./lib/envSchema";
import type { User, Sessions } from '@prove-it/db'

// ACCESS TOKEN GENERATION: Returns a new token with payload and expiry time
export async function generateAccessToken(payload: { publicId: User['publicId'] , sessionPublicId: Sessions['publicId'] }){
    return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(authEnv.APP_URL)        
    .setAudience(authEnv.APP_URL)  
    .setExpirationTime(authEnv.ACCESS_TOKEN_EXPIRES_IN)
    .sign(new TextEncoder().encode(authEnv.ACCESS_TOKEN_JWT_SECRET));
} 


// ACCESS TOKEN VERIFICATION: If token valid, return payload. If invalid, return null
export async function verifyAccessToken(token: string){
    try {
        const result = await jwtVerify(token, new TextEncoder().encode(authEnv.ACCESS_TOKEN_JWT_SECRET), {
            issuer: authEnv.APP_URL,
            audience: authEnv.APP_URL,
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
export async function generateRefreshToken(payload: { publicId: User['publicId'] , sessionPublicId: Sessions['publicId'] }){
    return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(authEnv.NEXT_PUBLIC_APP_URL)        
    .setAudience(authEnv.NEXT_PUBLIC_APP_URL)  
    .setExpirationTime(authEnv.REFRESH_TOKEN_EXPIRES_IN)
    .sign(new TextEncoder().encode(authEnv.REFRESH_TOKEN_JWT_SECRET));
} 

// REFRESH TOKEN VERIFICATION: If token valid, return payload. If invalid, return null
export async function verifyRefreshToken(token: string){
    try {
        const result = await jwtVerify(token, new TextEncoder().encode(authEnv.REFRESH_TOKEN_JWT_SECRET), {
            issuer: authEnv.NEXT_PUBLIC_APP_URL,
            audience: authEnv.NEXT_PUBLIC_APP_URL,
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