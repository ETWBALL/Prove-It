import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProveItRateLimit } from '@/lib/rateLimiter'
import { getClientIpForRateLimit } from '@/lib/requestIp'
import { LoginSchema } from '@/lib/Validation/zodSchemas';
import { verifyPassword, hashOpaqueToken } from '@/lib/AuthUtility/passwordHashing';
import { generateAccessToken, generateRefreshToken } from '@/lib/AuthUtility/auth-utility';
import { env } from '@/lib/Validation/zodSchemas';
import { cookieMaxAgeSeconds, expiresAtFromSpan } from '@/lib/date-utility';

function cookieSecure(request: Request): boolean {
    if (process.env.NODE_ENV === 'production') return true
    return request.headers.get('x-forwarded-proto') === 'https'
}

export async function POST(request: Request) {
    // (1) RATE LIMIT CHECK (IP-based because they aren't logged in yet)
    const ip = getClientIpForRateLimit(request);
    const { success } = await ProveItRateLimit.limit(ip);

    if (!success) {
        return NextResponse.json(
        { error: "Too many attempts. Please try again in a moment." }, 
        { status: 429 }
        );
    }
    
    // (2) Check if JSON body is valid
    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // (3) User Sanitization and Validation
    const validatedFields = LoginSchema.strict().safeParse(body)
    if (!validatedFields.success) {
        return NextResponse.json({ error: validatedFields.error.flatten().fieldErrors }, { status: 400 })
    }
    const { email, password } = validatedFields.data

    // (4) Check if the user exists. Assuming email and password are sanitized. Search for email.
    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
            privateId: true, // Do not return this to the user
            password: true, // Dangerous, make sure not to return it
            publicId: true,
        }
    })

    // User may not have been found
    if (!user || !user.password){
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // User may have been found. Check password.
    if (!await verifyPassword(password, user.password)){
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // (5) Generate JWT tokens, store their current session, and return to user
    const accessToken = await generateAccessToken({ publicId: user.publicId })
    const refreshToken = await generateRefreshToken({ publicId: user.publicId })

    const accessMaxAge = cookieMaxAgeSeconds(env.ACCESS_TOKEN_EXPIRES_IN)
    const refreshMaxAge = cookieMaxAgeSeconds(env.REFRESH_TOKEN_EXPIRES_IN)

    try {
        await prisma.sessions.create({
            data: {
                privateUserId: user.privateId!,
                refreshToken: await hashOpaqueToken(refreshToken),
                device: request.headers.get('user-agent') || 'Unknown',
                tokenExpiresAt: expiresAtFromSpan(env.REFRESH_TOKEN_EXPIRES_IN),
                lastActiveAt: new Date(),
            }
        })
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    const response = NextResponse.json({success: true, message: "login successful"}, { status: 200 })

    const secure = cookieSecure(request)
    response.cookies.set({
        name: 'accessToken',
        value: accessToken,
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: accessMaxAge,
    })
    response.cookies.set({
        name: 'refreshToken',
        value: refreshToken,
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: refreshMaxAge,
    })

    return response

}