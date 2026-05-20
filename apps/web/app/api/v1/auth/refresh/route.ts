import { NextRequest, NextResponse } from "next/server"
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken, hashOpaqueToken, verifyOpaqueToken} from "@prove-it/auth"
import { prisma } from '@prove-it/db'


// Local imports
import { TokenPayloadSchema, env } from "@/lib/Validation/zodSchemas"
import { cookieMaxAgeSeconds, expiresAtFromSpan } from '@/lib/date-utility';
import { refreshRatelimit } from "@/lib/rateLimiter";

function cookieSecure(request: Request): boolean {
    if (process.env.NODE_ENV === 'production') return true
    return request.headers.get('x-forwarded-proto') === 'https'
}

/** Generic client-facing copy for any refresh failure (avoid leaking session/token details). */
function refreshUnauthorized() {
    return NextResponse.json(
        { error: 'Unable to refresh session. Please sign in again.' },
        { status: 401 }
    )
}

export async function POST(request: NextRequest) {
    
    // (1) Get access and refresh tokens from cookies
    const accessToken = request.cookies.get('accessToken')?.value
    const refreshToken = request.cookies.get('refreshToken')?.value

    if (!refreshToken) {
        return refreshUnauthorized()
    }

    // RATE LIMIT CHECK (IP-based because they aren't logged in yet)
    const { success } = await refreshRatelimit.limit(`refresh:${refreshToken}`);

    if (!success) {
        return NextResponse.json(
        { error: "Too many refresh attempts. Please try again in a moment." }, 
        { status: 429 }
        );
    }

    // (2) if access is still valid, return both early. With a meaningful message. Else continue
    if (accessToken) {
        
        const accessTokenResult = await verifyAccessToken(accessToken)

        // Access token is still valid = Good user.
        if (accessTokenResult.valid) {
            // No need for new tokens
            return NextResponse.json({ message: 'Access token is still valid, no need to refresh' }, { status: 200 })
        }
    }

    // (3) if refresh is valid, generate new access and refresh token.

    const refreshTokenResult = await verifyRefreshToken(refreshToken)

    if (refreshTokenResult.expired || refreshTokenResult.invalid) {
        return refreshUnauthorized()
    }

    // (4) Assume cookie refresh is valid, cookie access is invalid. Check if cookie refresh matches with database refresh
    const payload = TokenPayloadSchema.safeParse(refreshTokenResult.payload)

    if (!payload.success) {
        return refreshUnauthorized()
    }

    let session: {
        refreshToken: string | null
        tokenExpiresAt: Date
        user: { publicId: string }
    } | null = null
    try {
        session = await prisma.sessions.findUnique({
            where: {
                publicId: payload.data.sessionPublicId
            },
            include: {
                user: { select: { publicId: true } },
            },
        })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        )
    }

    if (
        !session ||
        session.user.publicId !== payload.data.publicId ||
        session.tokenExpiresAt.getTime() <= Date.now() ||
        !session.refreshToken
    ) {
        return refreshUnauthorized()
    }

    if (!(await verifyOpaqueToken(refreshToken, session.refreshToken))) {
        return refreshUnauthorized()
    }

    // (5) Cookie refresh matches DB; issue new access and refresh tokens
    const newAccessToken = await generateAccessToken(payload.data)
    const newRefreshToken = await generateRefreshToken(payload.data)

    // (6) Update the existing session row with the new refresh token + expiry.
    try {
        await prisma.sessions.update({
            where: {
                publicId: payload.data.sessionPublicId
            },
            data: {
                refreshToken: await hashOpaqueToken(newRefreshToken),
                tokenExpiresAt: expiresAtFromSpan(env.REFRESH_TOKEN_EXPIRES_IN),
                lastActiveAt: new Date(),
            }
        })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        )
    }

    // (7) Store new tokens in cookies
    const response = NextResponse.json(
        { success: true, message: 'Session refreshed; new access and refresh tokens issued.' },
        { status: 200 }
    )

    const secure = cookieSecure(request)
    const accessMaxAge = cookieMaxAgeSeconds(env.ACCESS_TOKEN_EXPIRES_IN)
    const refreshMaxAge = cookieMaxAgeSeconds(env.REFRESH_TOKEN_EXPIRES_IN)

    response.cookies.set({
        name: 'accessToken',
        value: newAccessToken,
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: accessMaxAge,
    })
    response.cookies.set({
        name: 'refreshToken',
        value: newRefreshToken,
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: refreshMaxAge,
    })

    return response

}