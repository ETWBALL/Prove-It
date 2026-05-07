import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from '@prove-it/auth';
import { POST } from '../app/api/v1/auth/refresh/route';


const publicRoutes = [
    '/api/v1/auth/login',
    '/api/v1/auth/signup',
    '/api/v1/auth/refresh',
    '/api/v1/auth/logout',
    '/api/v1/plans',
    '/',
    '/login',
    '/signup',
    
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

    const response = (pathname: string, message: string): NextResponse => {
        if (isApiRoute(pathname)){
            return NextResponse.json({ error: message }, { status: 401 })
        }
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // Accessing a private route. Get access token
    const accessToken = request.cookies.get('accessToken')?.value

    // Verify access token
    if (!accessToken) {
        return response(pathname, 'Unauthorized')
    }

    // Continue with the payload
    const continueWithPayload = (payload: { publicId?: string; sessionPublicId?: string }, refreshResponse?: NextResponse) => {
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set('x-user-id', payload?.publicId as string)
        requestHeaders.set('x-session-id', payload?.sessionPublicId as string)

        const nextResponse = NextResponse.next({
            request: {
                headers: requestHeaders,
            }
        })

        // Preserve exact cookie attributes from refresh route (maxAge/expires/sameSite/etc.).
        if (refreshResponse) {
            const getSetCookie = (refreshResponse.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
            const setCookieValues =
                typeof getSetCookie === 'function'
                    ? getSetCookie.call(refreshResponse.headers)
                    : []

            if (setCookieValues.length > 0) {
                for (const value of setCookieValues) {
                    nextResponse.headers.append('set-cookie', value)
                }
            } else {
                const single = refreshResponse.headers.get('set-cookie')
                if (single) {
                    nextResponse.headers.append('set-cookie', single)
                }
            }
        }

        return nextResponse
    }

    try {
        const { valid, expired, payload } = await verifyAccessToken(accessToken)

        // If the access token is expired, try to refresh it 
        if (expired) {
            const refreshToken = request.cookies.get('refreshToken')?.value
            if (!refreshToken) {
                return response(pathname, 'Unauthorized')
            }

            // Try to refresh the access token
            const refreshResponse = await POST(request)
            if (!refreshResponse.ok) {
                return response(pathname, 'Access token expired')
            }

            // If the refresh was successful, get the new access and refresh tokens
            const refreshedAccessToken = refreshResponse.cookies.get('accessToken')?.value
            const refreshedRefreshToken = refreshResponse.cookies.get('refreshToken')?.value
            if (!refreshedAccessToken) {
                return response(pathname, 'Access token expired')
            }

            const refreshedVerification = await verifyAccessToken(refreshedAccessToken)
            if (!refreshedVerification.valid || !refreshedVerification.payload) {
                return response(pathname, 'Access token expired')
            }

            // Continue with the new access and refresh tokens
            return continueWithPayload(
                refreshedVerification.payload as { publicId?: string; sessionPublicId?: string },
                refreshResponse
            )
        }

        // If the access token is invalid, return an unauthorized response
        if (!valid) {
            return response(pathname, 'Invalid access token')
        }

        // If the access token is valid, continue with the payload
        return continueWithPayload(payload as { publicId?: string; sessionPublicId?: string })
    } catch {
        return response(pathname, 'Unauthorized')
    }
    

}
