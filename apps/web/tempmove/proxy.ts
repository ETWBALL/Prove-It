import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from '@prove-it/auth';


const publicRoutes = [
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/auth/logout',
    '/api/v1/plans',
    '/',
]

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ]
}

function isApiRoute(pathname: string): boolean {
    return pathname.startsWith('/api/')
}

export async function proxy(request: NextRequest) {
    // Check if the path is a public route or page
    const { pathname } = request.nextUrl

    if (publicRoutes.includes(pathname)){
        return NextResponse.next()
    }

    // Accessing a private route. Get access token
    const accessToken = request.cookies.get('accessToken')?.value

    // Verify access token
    if (!accessToken) {
        if (isApiRoute(pathname)){
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return NextResponse.redirect(new URL('/', request.url))
    }

    const { valid, expired, payload } = await verifyAccessToken(accessToken)
    if (expired){return NextResponse.json({ error: 'Access token expired' }, { status: 401 })}
    if (!valid) {return NextResponse.json({ error: expired ? 'Access token expired' : 'Invalid access token' }, { status: 401 })}


    // Valid access token, attach payload
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', payload?.publicId as string)
    requestHeaders.set('x-session-id', payload?.sessionPublicId as string)

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        }
    })
    

}
