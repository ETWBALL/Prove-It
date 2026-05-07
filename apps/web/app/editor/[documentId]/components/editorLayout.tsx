'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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

type DeltaType = 'insert' | 'delete' | 'replace'

type ComputedDelta = {
  type: DeltaType
  startIndex: number
  endIndex: number
  content: string
}

type EditorLayoutProps = {
  documentId: string
}

type SocketStatus = 'connecting' | 'connected' | 'joined' | 'error' | 'disconnected'

function computeDelta(previousContent: string, nextContent: string): ComputedDelta | null {
  if (previousContent === nextContent) return null

  let commonPrefix = 0
  while (
    commonPrefix < previousContent.length &&
    commonPrefix < nextContent.length &&
    previousContent[commonPrefix] === nextContent[commonPrefix]
  ) {
    commonPrefix += 1
  }

  let previousTail = previousContent.length - 1
  let nextTail = nextContent.length - 1
  while (
    previousTail >= commonPrefix &&
    nextTail >= commonPrefix &&
    previousContent[previousTail] === nextContent[nextTail]
  ) {
    previousTail -= 1
    nextTail -= 1
  }

  const removedLength = Math.max(0, previousTail - commonPrefix + 1)
  const insertedContent = nextContent.slice(commonPrefix, nextTail + 1)

  if (removedLength === 0 && insertedContent.length > 0) {
    return {
      type: 'insert',
      startIndex: commonPrefix,
      endIndex: commonPrefix,
      content: insertedContent,
    }
  }

  if (removedLength > 0 && insertedContent.length === 0) {
    return {
      type: 'delete',
      startIndex: commonPrefix,
      endIndex: commonPrefix + removedLength,
      content: '',
    }
  }

  return {
    type: 'replace',
    startIndex: commonPrefix,
    endIndex: commonPrefix + removedLength,
    content: insertedContent,
  }
}

function applyDelta(content: string, delta: ComputedDelta): string {
  switch (delta.type) {
    case 'insert':
      return content.slice(0, delta.startIndex) + delta.content + content.slice(delta.startIndex)
    case 'delete':
      return content.slice(0, delta.startIndex) + content.slice(delta.endIndex)
    case 'replace':
      return content.slice(0, delta.startIndex) + delta.content + content.slice(delta.endIndex)
    default:
      return content
  }
}

function deltaFromBeforeInput(
  event: FormEvent<HTMLTextAreaElement>,
  currentContent: string
): ComputedDelta | null {
  const target = event.currentTarget
  const start = target.selectionStart
  const end = target.selectionEnd
  const hasSelection = start !== end

  const native = event.nativeEvent as InputEvent
  const inputType = native.inputType ?? ''
  const data = native.data ?? ''

  if (inputType.startsWith('insert')) {
    if (hasSelection) {
      if (data.length === 0) return null
      return { type: 'replace', startIndex: start, endIndex: end, content: data }
    }
    if (data.length === 0) return null
    return { type: 'insert', startIndex: start, endIndex: start, content: data }
  }

  if (inputType.startsWith('delete')) {
    if (hasSelection) {
      return { type: 'delete', startIndex: start, endIndex: end, content: '' }
    }

    if (inputType === 'deleteContentBackward') {
      if (start === 0) return null
      return { type: 'delete', startIndex: start - 1, endIndex: start, content: '' }
    }

    if (inputType === 'deleteContentForward') {
      if (start >= currentContent.length) return null
      return { type: 'delete', startIndex: start, endIndex: start + 1, content: '' }
    }

    // Fallback for delete variants without explicit direction.
    if (start === 0) return null
    return { type: 'delete', startIndex: start - 1, endIndex: start, content: '' }
  }

  return null
}

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
  const pendingDeltaQueueRef = useRef<ComputedDelta[]>([])
  const inFlightDeltaRef = useRef<ComputedDelta | null>(null)

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

    socket.on('connect_error', (error: Error) => {
      setStatus('error')
      setStatusMessage(`Realtime connection failed: ${error.message}`)
    })

    socket.on('document:join:processing', () => {
      setStatusMessage('Loading document...')
    })

    socket.on('document:join:success', (payload: JoinSuccessPayload) => {
      setDraftContent(payload.content ?? '')
      setBaseContent(payload.content ?? '')
      setRevision(payload.revision ?? 0)
      setErrors(payload.errors ?? [])
      pendingDeltaQueueRef.current = []
      inFlightDeltaRef.current = null
      setStatus('joined')
      setStatusMessage(`Connected to document ${payload.documentId}`)
    })

    socket.on('document:join:error', (payload: { code?: string }) => {
      setStatus('error')
      setStatusMessage(`Unable to join document (${payload?.code ?? 'UNKNOWN'})`)
    })

    socket.on('document:delta:ack', (payload: DeltaAckPayload) => {
      const acknowledgedDelta = inFlightDeltaRef.current
      setRevision(payload.revision)
      setBaseContent((previous) => {
        if (!acknowledgedDelta) return previous
        return applyDelta(previous, acknowledgedDelta)
      })
      inFlightDeltaRef.current = null
      setDeltaInFlight(false)
    })

    socket.on('document:errors:removed', (payload: { errorIds?: string[] }) => {
      const ids = new Set(payload.errorIds ?? [])
      setErrors((prev) => prev.filter((error) => !ids.has(error.publicId)))
    })

    socket.on('document:delta:error', (payload: DeltaErrorPayload) => {
      setStatus('error')
      setStatusMessage(`Delta rejected (${payload.code}). Re-syncing...`)
      inFlightDeltaRef.current = null
      pendingDeltaQueueRef.current = []
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

  function handleProofBeforeInput(event: FormEvent<HTMLTextAreaElement>) {
    if (status !== 'joined') return
    const nextDelta = deltaFromBeforeInput(event, draftContent)
    if (!nextDelta) return
    pendingDeltaQueueRef.current.push(nextDelta)
  }

  useEffect(() => {
    if (status !== 'joined' || deltaInFlight) {
      return
    }

    const socket = socketRef.current
    if (!socket) return

    const delta =
      pendingDeltaQueueRef.current.shift() ?? computeDelta(baseContent, draftContent)
    if (!delta) return

    const nextRevision = revision + 1
    inFlightDeltaRef.current = delta
    setDeltaInFlight(true)

    socket.emit('document:delta', {
      type: delta.type,
      documentId,
      startIndex: delta.startIndex,
      endIndex: delta.endIndex,
      content: delta.content,
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
        onProofBeforeInput={handleProofBeforeInput}
        onProofChange={setDraftContent}
      />

      <ErrorPanel errors={errors} />
    </main>
  )
}
