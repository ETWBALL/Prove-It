'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import Editor from './editor'
import ErrorPanel from './errorPanel'

type SuggestionState = {
  suggestionContent: string
  startIndexSuggestion: number
  endIndexSuggestion: number
}

type ErrorState = {
  publicId: string
  errorContent: string
  startIndexError: number
  endIndexError: number
  suggestion: SuggestionState | null
}

type JoinSuccessPayload = {
  documentId: string
  content: string
  revision: number
  errors: ErrorState[]
}

type DeltaAckPayload = {
  revision: number
}

type DeltaErrorPayload = {
  code: string
}

type EditorLayoutProps = {
  documentId: string
}

type SocketStatus = 'connecting' | 'connected' | 'joined' | 'error' | 'disconnected'

export default function EditorLayout({ documentId }: EditorLayoutProps) {
  const [statement, setStatement] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [baseContent, setBaseContent] = useState('')
  const [errors, setErrors] = useState<ErrorState[]>([])
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const [statusMessage, setStatusMessage] = useState('Connecting to realtime service...')
  const [deltaInFlight, setDeltaInFlight] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const inFlightTargetRef = useRef('')

  const wsUrl = useMemo(
    () => process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001',
    []
  )

  useEffect(() => {
    const socket = io(wsUrl, {
      autoConnect: true,
      transports: ['websocket'],
      withCredentials: true,
    })

    socketRef.current = socket
    setStatus('connecting')
    setStatusMessage('Connecting to realtime service...')

    socket.on('connect', () => {
      setStatus('connected')
      setStatusMessage('Connected. Joining document...')
      socket.emit('document:join', documentId)
    })

    socket.on('document:join:processing', () => {
      setStatusMessage('Loading document...')
    })

    socket.on('document:join:success', (payload: JoinSuccessPayload) => {
      setDraftContent(payload.content ?? '')
      setBaseContent(payload.content ?? '')
      setRevision(payload.revision ?? 0)
      setErrors(payload.errors ?? [])
      setStatus('joined')
      setStatusMessage(`Connected to document ${payload.documentId}`)
    })

    socket.on('document:join:error', (payload: { code?: string }) => {
      setStatus('error')
      setStatusMessage(`Unable to join document (${payload?.code ?? 'UNKNOWN'})`)
    })

    socket.on('document:delta:ack', (payload: DeltaAckPayload) => {
      setRevision(payload.revision)
      setBaseContent(inFlightTargetRef.current)
      setDeltaInFlight(false)
    })

    socket.on('document:errors:removed', (payload: { errorIds?: string[] }) => {
      const ids = new Set(payload.errorIds ?? [])
      setErrors((prev) => prev.filter((error) => !ids.has(error.publicId)))
    })

    socket.on('document:delta:error', (payload: DeltaErrorPayload) => {
      setStatus('error')
      setStatusMessage(`Delta rejected (${payload.code}). Re-syncing...`)
      setDeltaInFlight(false)
      socket.emit('document:join', documentId)
    })

    socket.on('disconnect', () => {
      setStatus('disconnected')
      setStatusMessage('Disconnected from realtime service.')
    })

    return () => {
      socket.emit('document:leave', documentId)
      socket.disconnect()
      socketRef.current = null
    }
  }, [documentId, wsUrl])

  useEffect(() => {
    if (status !== 'joined' || deltaInFlight || draftContent === baseContent) {
      return
    }

    const socket = socketRef.current
    if (!socket) return

    const nextRevision = revision + 1
    inFlightTargetRef.current = draftContent
    setDeltaInFlight(true)

    socket.emit('document:delta', {
      type: 'replace',
      documentId,
      startIndex: 0,
      endIndex: baseContent.length,
      content: draftContent,
      revision: nextRevision,
    })
  }, [baseContent, deltaInFlight, documentId, draftContent, revision, status])

  const statusDotClass =
    status === 'joined'
      ? 'bg-green-500'
      : status === 'error'
        ? 'bg-red-500'
        : status === 'disconnected'
          ? 'bg-yellow-500'
          : 'bg-blue-500'

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-medium text-gray-200">Document: {documentId}</p>
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-300">
          <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} />
          <span>{statusMessage}</span>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Revision: {revision} {deltaInFlight ? '(syncing...)' : ''}
        </p>
      </header>

      <Editor
        statement={statement}
        proof={draftContent}
        disabled={status !== 'joined'}
        onStatementChange={setStatement}
        onProofChange={setDraftContent}
      />

      <ErrorPanel errors={errors} />
    </main>
  )
}
