import { NextResponse } from 'next/server'
import type { UniversityDomain } from '@prove-it/db'
import { prisma } from '@prove-it/db'
import { generateAccessToken, generateRefreshToken, hashOpaqueToken, hashPassword } from '@prove-it/auth'

// Local imports
import { env, SignupSchema } from '@/lib/Validation/zodSchemas'
import { ProveItRateLimit } from '@/lib/rateLimiter'
import { getClientIpForRateLimit } from '@/lib/requestIp'
import { cookieMaxAgeSeconds, expiresAtFromSpan } from '@/lib/date-utility'

function cookieSecure(request: Request): boolean {
    if (process.env.NODE_ENV === 'production') return true
    return request.headers.get('x-forwarded-proto') === 'https'
}


export async function POST(request: Request) {
    // RATE LIMIT CHECK (IP-based because they aren't logged in yet)
    const ip = getClientIpForRateLimit(request);
    const { success } = await ProveItRateLimit.limit(ip);

    if (!success) {
        return NextResponse.json(
        { error: "Too many attempts. Please try again in a moment." }, 
        { status: 429 }
        );
    }
    
    // Never trust user input, sanitize and validate it
    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validatedFields = SignupSchema.strict().safeParse(body)
    if (!validatedFields.success) {
        return NextResponse.json({ error: validatedFields.error.flatten().fieldErrors }, { status: 400 })
    }

    const { email, password, universityId } = validatedFields.data
    const publicUniversityId = universityId
    let privateUniversityId: number | null = null; 

    // If this is a student with a valid universityId, check if the email domain is valid
    if (publicUniversityId) {
        // Find the email domains associated with the university
        const universityDomain = await prisma.universityDomain.findMany({
            where: { 
                university: {
                    publicId: publicUniversityId
                }
            }
        })

        if (universityDomain.length === 0) {
            return NextResponse.json({ error: 'Invalid university id' }, { status: 400 })
        }

        // Check if the email domain is valid. They must use their student email.
        const emailDomain = email.split('@')[1].toLowerCase()
        if (!universityDomain.some((domain: UniversityDomain) => domain.domain.toLowerCase() === emailDomain)) {
            return NextResponse.json({ error: 'Invalid email domain. Please use your student email when signing up.' }, { status: 400 })
        }
        privateUniversityId = universityDomain[0].privateUniversityId
    }

    // At this point, we assume the email, password, and optional university id are valid. 
    // Try to create a new user. User may also exist
    const hashedPassword = await hashPassword(password)
    try {
        const { user, refreshToken, sessionPublicId } = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: email,
                    password: hashedPassword,
                    privateUniversityId: privateUniversityId,
                },
                select: {
                    name: true,
                    username: true,
                    email: true,
                    bio: true,
                    avatarUrl: true,
                    publicId: true,
                    privateId: true,
                },
            })

            const session = await tx.sessions.create({
                data: {
                    privateUserId: user.privateId,
                    device: request.headers.get('user-agent') || 'Unknown',
                    tokenExpiresAt: expiresAtFromSpan(env.REFRESH_TOKEN_EXPIRES_IN),
                    lastActiveAt: new Date(),
                },
            })

            const refreshToken = await generateRefreshToken({
                publicId: user.publicId,
                sessionPublicId: session.publicId,
            })

            await tx.sessions.update({
                where: { publicId: session.publicId },
                data: {
                    refreshToken: await hashOpaqueToken(refreshToken),
                },
            })

            return { user, refreshToken, sessionPublicId: session.publicId }
        })

        const accessToken = await generateAccessToken({
            publicId: user.publicId,
            sessionPublicId,
        })

        const accessMaxAge = cookieMaxAgeSeconds(env.ACCESS_TOKEN_EXPIRES_IN)
        const refreshMaxAge = cookieMaxAgeSeconds(env.REFRESH_TOKEN_EXPIRES_IN)

        const response = NextResponse.json({success: true, message: "Signup successful", user: {
            name: user.name,
            username: user.username,
            email: user.email,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            publicId: user.publicId,
        }}, { status: 201 })

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


    } catch (error: unknown) {
        const prismaError = error as {
            code?: string
            meta?: { target?: string[] | string }
        }

        if (prismaError?.code === 'P2002') {
            const target = prismaError.meta?.target
            const fields = (
                Array.isArray(target) ? target : typeof target === 'string' ? [target] : []
            ) as string[]

            if (fields.includes('email')) {
                return NextResponse.json(
                    { error: 'Email already registered' },
                    { status: 409 }
                )
            }
            if (fields.includes('username')) {
                return NextResponse.json(
                    { error: 'Username already taken' },
                    { status: 409 }
                )
            }
            if (fields.includes('publicId')) {
                return NextResponse.json(
                    { error: 'Could not create account. Please try again.' },
                    { status: 409 }
                )
            }
            return NextResponse.json(
                { error: 'A record with this value already exists.' },
                { status: 409 }
            )
        }
        console.error(error)
        return NextResponse.json(
            { error: 'Something went wrong. Please try again later.' },
            { status: 500 }
        )
    }
}