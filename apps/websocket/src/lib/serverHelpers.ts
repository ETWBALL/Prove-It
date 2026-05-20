import { Server } from 'socket.io';
import { verifyAccessToken } from '@prove-it/auth';

export function middleware(io: Server) {
    io.use(async(socket, next) => {
        try {
            // (1) Extract access token and verify it
            const accessToken = socket.handshake.auth.accessToken
            if (!accessToken) {
                return next(new Error('Unauthorized'))
            }
            const { valid, expired, invalid, payload } = await verifyAccessToken(accessToken)

            if (expired){
                return next(new Error('Unauthorized: TOKEN_EXPIRED'))
            }

            if (!valid || invalid ) {
                return next(new Error('Unauthorized'))
            }

            socket.data.user = payload as { publicId: string, sessionPublicId: string }
            next()
        }catch (error) {
            console.error('Authentication error:', error)
            return next(new Error('Unauthorized'))
        }
    })
}


