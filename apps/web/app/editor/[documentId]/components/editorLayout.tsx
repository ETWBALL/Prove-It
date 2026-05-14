'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import Editor, { EditorHandle, EditorHighlight } from './editor'
import ErrorPanel from './errorPanel'
import MathStatementsPanel, { MathStatement } from './mathStatementsPanel'

type SuggestionState = {
  suggestionContent: string
  startIndexSuggestion: number
  endIndexSuggestion: number
}

type ServerErrorState = {
  publicId?: string | null
  errorMessage: string
  errortype: string
  startIndexError: number
  endIndexError: number
  problematicContent?: string | null
  suggestion?: SuggestionState | null
  MLTriggered?: boolean
  resolvedAt?: string | null
  dismissedAt?: string | null
}

type LocalErrorState = {
  publicId?: string
  clientId: string
  errorMessage: string
  errortype: string
  startIndexError: number
  endIndexError: number
  problematicContent?: string
  suggestion: SuggestionState | null
  MLTriggered: boolean
}

type JoinSuccessPayload = {
  documentId: string
  content: string
  revision: number
  errors: ServerErrorState[]
  questionContent: string
  questionRevision: number
  mathStatements: MathStatement[]
  proofType: string | null
  coursePublicId: string | null
}

type DeltaAckPayload = {
  revision: number
}

type DeltaErrorPayload = {
  code: string
}

type MLResultPayload = {
  documentId: string
  errors?: ServerErrorState[]
  mathStatements?: MathStatement[]
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

// Build a stable identity for the client. ``publicId`` is the source of truth once persisted; for
// freshly-detected ML errors (publicId === undefined) we derive a key from anchors + type so the
// activeErrorId survives subsequent ml:result re-broadcasts that ship the cumulative error list.
function deriveClientId(error: ServerErrorState): string {
  if (error.publicId) return error.publicId
  return `local-${error.startIndexError}-${error.endIndexError}-${error.errortype}`
}

function normalizeError(error: ServerErrorState): LocalErrorState {
  return {
    publicId: error.publicId ?? undefined,
    clientId: deriveClientId(error),
    errorMessage: error.errorMessage,
    errortype: error.errortype,
    startIndexError: error.startIndexError,
    endIndexError: error.endIndexError,
    problematicContent: error.problematicContent ?? undefined,
    suggestion: error.suggestion ?? null,
    MLTriggered: Boolean(error.MLTriggered),
  }
}

// Diff two strings into the minimal insert / delete / replace span. Used as a fallback when the
// onBeforeInput path missed an edit (paste from non-input sources, IME composition, etc.).
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

function deltaFromBeforeInput<T extends HTMLTextAreaElement | HTMLInputElement>(
  event: FormEvent<T>,
  currentContent: string,
): ComputedDelta | null {
  const target = event.currentTarget
  const start = target.selectionStart ?? currentContent.length
  const end = target.selectionEnd ?? start
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

    if (start === 0) return null
    return { type: 'delete', startIndex: start - 1, endIndex: start, content: '' }
  }

  return null
}

export default function EditorLayout({ documentId }: EditorLayoutProps) {
  // Proving-statement (question) sync state.
  const [draftQuestion, setDraftQuestion] = useState('')
  const [baseQuestion, setBaseQuestion] = useState('')
  const [questionRevision, setQuestionRevision] = useState(0)
  const [questionInFlight, setQuestionInFlight] = useState(false)

  // Proof body sync state.
  const [draftContent, setDraftContent] = useState('')
  const [baseContent, setBaseContent] = useState('')
  const [revision, setRevision] = useState(0)
  const [deltaInFlight, setDeltaInFlight] = useState(false)

  // Side panels (errors + math statements).
  const [errors, setErrors] = useState<LocalErrorState[]>([])
  const [mathStatements, setMathStatements] = useState<MathStatement[]>([])
  const [activeErrorId, setActiveErrorId] = useState<string | null>(null)

  // Connection lifecycle.
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const [statusMessage, setStatusMessage] = useState('Connecting to realtime service...')

  const socketRef = useRef<Socket | null>(null)
  const editorRef = useRef<EditorHandle | null>(null)

  // Body delta plumbing.
  const pendingDeltaQueueRef = useRef<ComputedDelta[]>([])
  const inFlightDeltaRef = useRef<ComputedDelta | null>(null)

  // Proving statement delta plumbing.
  const pendingQuestionQueueRef = useRef<ComputedDelta[]>([])
  const inFlightQuestionDeltaRef = useRef<ComputedDelta | null>(null)

  const wsUrl = useMemo(() => process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001', [])

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
      const initialContent = payload.content ?? ''
      const initialQuestion = payload.questionContent ?? ''

      setDraftContent(initialContent)
      setBaseContent(initialContent)
      setRevision(payload.revision ?? 0)

      setDraftQuestion(initialQuestion)
      setBaseQuestion(initialQuestion)
      setQuestionRevision(payload.questionRevision ?? 0)

      setErrors((payload.errors ?? []).map(normalizeError))
      setMathStatements(payload.mathStatements ?? [])

      pendingDeltaQueueRef.current = []
      inFlightDeltaRef.current = null
      pendingQuestionQueueRef.current = []
      inFlightQuestionDeltaRef.current = null

      setStatus('joined')
      setStatusMessage(`Connected to document ${payload.documentId}`)
    })

    socket.on('document:join:error', (payload: { code?: string }) => {
      setStatus('error')
      setStatusMessage(`Unable to join document (${payload?.code ?? 'UNKNOWN'})`)
    })

    // Body delta ack — server accepted the in-flight delta; advance the base content + revision.
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

    socket.on('document:delta:error', (payload: DeltaErrorPayload) => {
      setStatus('error')
      setStatusMessage(`Delta rejected (${payload.code}). Re-syncing...`)
      inFlightDeltaRef.current = null
      pendingDeltaQueueRef.current = []
      setDeltaInFlight(false)
      socket.emit('document:join', documentId)
    })

    // Proving statement ack / error — same dance, separate channel.
    socket.on('document:qDelta:ack', (payload: DeltaAckPayload) => {
      const acknowledgedDelta = inFlightQuestionDeltaRef.current
      setQuestionRevision(payload.revision)
      setBaseQuestion((previous) => {
        if (!acknowledgedDelta) return previous
        return applyDelta(previous, acknowledgedDelta)
      })
      inFlightQuestionDeltaRef.current = null
      setQuestionInFlight(false)
    })

    socket.on('document:qDelta:error', (payload: DeltaErrorPayload) => {
      setStatusMessage(`Proving statement delta rejected (${payload.code}). Re-syncing...`)
      inFlightQuestionDeltaRef.current = null
      pendingQuestionQueueRef.current = []
      setQuestionInFlight(false)
      socket.emit('document:join', documentId)
    })

    // Server tells us when errors were invalidated (overlap with a typed delta). Drop them locally
    // so the side panel and the overlay update before the next ML pass.
    socket.on('document:errors:removed', (payload: { errorIds?: string[] }) => {
      const ids = new Set(payload.errorIds ?? [])
      setErrors((prev) => prev.filter((error) => !error.publicId || !ids.has(error.publicId)))
    })

    // ML pipeline result: either replaces the document's error list or the math statements list.
    socket.on('document:ml:result', (payload: MLResultPayload) => {
      if (Array.isArray(payload.errors)) {
        setErrors(payload.errors.map(normalizeError))
      }
      if (Array.isArray(payload.mathStatements)) {
        setMathStatements(payload.mathStatements)
      }
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

  // Body: queue a delta as the user types. We rely on onBeforeInput so each keystroke is captured
  // before React re-renders the textarea, keeping our index math aligned with the live value.
  const handleProofBeforeInput = useCallback(
    (event: FormEvent<HTMLTextAreaElement>) => {
      if (status !== 'joined') return
      const nextDelta = deltaFromBeforeInput(event, draftContent)
      if (!nextDelta) return
      pendingDeltaQueueRef.current.push(nextDelta)
    },
    [draftContent, status],
  )

  // Proving statement: same pattern as the body but routed through document:qDelta.
  const handleStatementBeforeInput = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      if (status !== 'joined') return
      const nextDelta = deltaFromBeforeInput(event, draftQuestion)
      if (!nextDelta) return
      pendingQuestionQueueRef.current.push(nextDelta)
    },
    [draftQuestion, status],
  )

  // Flush the body queue whenever no delta is in flight.
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

  // Flush the proving statement queue. Independent revision counter, independent in-flight ref.
  useEffect(() => {
    if (status !== 'joined' || questionInFlight) {
      return
    }
    const socket = socketRef.current
    if (!socket) return

    const delta =
      pendingQuestionQueueRef.current.shift() ?? computeDelta(baseQuestion, draftQuestion)
    if (!delta) return

    const nextRevision = questionRevision + 1
    inFlightQuestionDeltaRef.current = delta
    setQuestionInFlight(true)

    socket.emit('document:qDelta', {
      type: delta.type,
      documentId,
      startIndex: delta.startIndex,
      endIndex: delta.endIndex,
      content: delta.content,
      revision: nextRevision,
    })
  }, [baseQuestion, documentId, draftQuestion, questionInFlight, questionRevision, status])

  // Hide ``MLTriggered`` / resolved / dismissed errors from the live overlay — they're stale
  // anchors and the suggestion is being re-evaluated.
  const editorHighlights: EditorHighlight[] = useMemo(
    () =>
      errors
        .filter((error) => !error.MLTriggered)
        .map((error) => ({
          id: error.clientId,
          start: error.startIndexError,
          end: error.endIndexError,
        })),
    [errors],
  )

  const handleSelectError = useCallback((error: LocalErrorState) => {
    setActiveErrorId(error.clientId)
    editorRef.current?.focusProofRange(error.startIndexError, error.endIndexError)
  }, [])

  const statusDotClass =
    status === 'joined'
      ? 'bg-emerald-500'
      : status === 'error'
        ? 'bg-red-500'
        : status === 'disconnected'
          ? 'bg-yellow-500'
          : 'bg-blue-500'

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-6">
      <header className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-200">Document: {documentId}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
              <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} />
              <span>{statusMessage}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>
              Proof rev <span className="font-semibold text-gray-200">{revision}</span>
              {deltaInFlight ? ' (syncing...)' : ''}
            </span>
            <span>
              Statement rev{' '}
              <span className="font-semibold text-gray-200">{questionRevision}</span>
              {questionInFlight ? ' (syncing...)' : ''}
            </span>
          </div>
        </div>
      </header>

      <div className="grid min-h-[80vh] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Editor
          ref={editorRef}
          statement={draftQuestion}
          proof={draftContent}
          disabled={status !== 'joined'}
          highlights={editorHighlights}
          activeHighlightId={activeErrorId}
          onStatementChange={setDraftQuestion}
          onStatementBeforeInput={handleStatementBeforeInput}
          onProofChange={setDraftContent}
          onProofBeforeInput={handleProofBeforeInput}
        />

        <aside className="flex min-h-0 flex-col gap-4">
          <div className="flex min-h-0 flex-1 flex-col">
            <MathStatementsPanel statements={mathStatements} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <ErrorPanel
              errors={errors}
              activeErrorId={activeErrorId}
              onSelectError={handleSelectError}
            />
          </div>
        </aside>
      </div>
    </main>
  )
}
