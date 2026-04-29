import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProveItRateLimit } from '@/lib/rateLimiter'
import { getClientIpForRateLimit } from '@/lib/requestIp'
import { LoginSchema } from '@/lib/Validation/zodSchemas';
import { verifyPassword } from '@/lib/AuthUtility/passwordHashing';


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
            password: true, // Dangerous, make sure not to return it
            name: true,
            username: true,
            email: true,
            bio: true,
            avatarUrl: true,
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

    // (5) Return JWT token

    // DONT RETURN PASSWORD

}