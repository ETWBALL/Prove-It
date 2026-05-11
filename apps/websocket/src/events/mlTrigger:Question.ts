import Redis from 'ioredis'
import { AuthenticatedSocket, DocumentState, MathStatements } from '../../lib/types'

const redisHost = process.env.REDIS_HOST ?? 'localhost'
const redisPort = Number(process.env.REDIS_PORT ?? 6379)
const redisPassword = process.env.REDIS_PASSWORD || undefined

const redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
})



export async function onQuestionMLTrigger(
    socket: AuthenticatedSocket,
    documentStates: Map<string, DocumentState>,
    documentID: string,
    socketDocumentMap: Map<string, string>,
    library: Map<string, MathStatements[]>
) {
    try {
        // (1) Basic checks
        const joinedDocumentId = socketDocumentMap.get(socket.id)

        if (!socket.data.user || !joinedDocumentId) {
            socket.emit('document:question:ml:trigger:error', { code: 'UNAUTHORIZED' })
            return
        }
        if (documentID !== joinedDocumentId) {
            socket.emit('document:question:ml:trigger:error', { code: 'FORBIDDEN' })
            return
        }

        const docState = documentStates.get(joinedDocumentId)
        if (!docState) {
            socket.emit('document:question:ml:trigger:error', { code: 'DOCUMENT_STATE_MISSING' })
            return
        }

        // (2) Pull course-scoped library entries if this document belongs to a course
        const questionContent = docState.questionContent
        const mathStatements: MathStatements[] = docState.coursePublicId
            ? (library.get(docState.coursePublicId) ?? [])
            : []


        // (3) Enqueue ML request for proving-statement assistance

        await redis.lpush('ml:queue:analyze', JSON.stringify({
            documentId: documentID,
            taskType: 'question_analysis',
            payload: {
                questionContent: questionContent,
                mathStatements: mathStatements,
                proofType: docState.proofType,
            }
        }))

        socket.emit('document:question:ml:triggered', { message: 'ML triggered for question analysis.' })

    } catch (error) {
        console.error(`Failed to trigger question ML for document ${documentID}:`, error)
        socket.emit('document:question:ml:trigger:error', { code: 'INTERNAL_ERROR' })
    }
}