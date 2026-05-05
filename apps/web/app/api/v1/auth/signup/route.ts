import { NextResponse } from 'next/server'
import type { UniversityDomain } from '@prove-it/db'
import { PrismaClientKnownRequestError, prisma} from '@prove-it/db'
import { hashPassword } from '@prove-it/auth'

// Local imports
import { SignupSchema } from '@/lib/Validation/zodSchemas'
import { ProveItRateLimit } from '@/lib/rateLimiter'
import { getClientIpForRateLimit } from '@/lib/requestIp'



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
    try{
        const user = await prisma.user.create({
            data: {
                email: email,
                password: hashedPassword,
                privateUniversityId: privateUniversityId
            },
            select: {
                name: true,
                username: true,
                email: true,
                bio: true,
                avatarUrl: true,
                publicId: true,
            }
        });

        return NextResponse.json({ user }, { status: 201 })

    } catch (error: unknown) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
            const target = error.meta?.target
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