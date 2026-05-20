'use client'

import {
  forwardRef,
  FormEvent,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'

export type EditorHighlight = {
  id: string
  start: number
  end: number
}

export type EditorHandle = {
  focusProofRange: (start: number, end: number) => void
}

type EditorProps = {
  statement: string
  proof: string
  disabled?: boolean
  highlights?: EditorHighlight[]
  activeHighlightId?: string | null
  onStatementChange: (value: string) => void
  onStatementBeforeInput: (event: FormEvent<HTMLInputElement>) => void
  onProofChange: (value: string) => void
  onProofBeforeInput: (event: FormEvent<HTMLTextAreaElement>) => void
}

type Segment = {
  text: string
  highlightId: string | null
}

// Break ``content`` into runs that are either plain text or wrapped in an error range. The overlay
// renders these runs with the same layout as the textarea so the wavy red underline lines up with
// the real glyphs underneath.
function buildSegments(content: string, highlights: EditorHighlight[]): Segment[] {
  if (highlights.length === 0) {
    return [{ text: content, highlightId: null }]
  }

  // Sort and clamp ranges to the current content length. Drop empty / inverted ranges.
  const sorted = highlights
    .map((h) => ({
      id: h.id,
      start: Math.max(0, Math.min(h.start, content.length)),
      end: Math.max(0, Math.min(h.end, content.length)),
    }))
    .filter((h) => h.end > h.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const segments: Segment[] = []
  let cursor = 0

  for (const range of sorted) {
    // Skip ranges that are fully inside an already-emitted segment (overlapping highlights).
    if (range.start < cursor) {
      const start = cursor
      const end = Math.max(cursor, range.end)
      if (end > start) {
        segments.push({ text: content.slice(start, end), highlightId: range.id })
        cursor = end
      }
      continue
    }
    if (range.start > cursor) {
      segments.push({ text: content.slice(cursor, range.start), highlightId: null })
    }
    segments.push({ text: content.slice(range.start, range.end), highlightId: range.id })
    cursor = range.end
  }

  if (cursor < content.length) {
    segments.push({ text: content.slice(cursor), highlightId: null })
  }
  return segments
}

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  {
    statement,
    proof,
    disabled = false,
    highlights = [],
    activeHighlightId = null,
    onStatementChange,
    onStatementBeforeInput,
    onProofChange,
    onProofBeforeInput,
  }: EditorProps,
  ref,
) {
  const proofTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  // ``overlayContentRef`` is the layer we translate to mirror textarea scrollTop. We can't use
  // ``scrollTop`` on the overlay itself because ``overflow: hidden`` (required to avoid scrollbars
  // bleeding through the underlay) blocks programmatic scrolling.
  const overlayContentRef = useRef<HTMLDivElement | null>(null)

  function syncOverlayScroll(textarea: HTMLTextAreaElement) {
    const content = overlayContentRef.current
    if (!content) return
    content.style.transform = `translate3d(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px, 0)`
  }

  useImperativeHandle(
    ref,
    () => ({
      focusProofRange(start, end) {
        const textarea = proofTextareaRef.current
        if (!textarea) return
        const clampedStart = Math.max(0, Math.min(start, textarea.value.length))
        const clampedEnd = Math.max(clampedStart, Math.min(end, textarea.value.length))
        textarea.focus()
        textarea.setSelectionRange(clampedStart, clampedEnd)

        // Scroll the selected range roughly into view by approximating the line.
        const before = textarea.value.slice(0, clampedStart)
        const lineNumber = before.split('\n').length - 1
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight || '24') || 24
        const target = Math.max(0, lineNumber * lineHeight - textarea.clientHeight / 2)
        textarea.scrollTop = target
        syncOverlayScroll(textarea)
      },
    }),
    [],
  )

  const segments = useMemo(() => buildSegments(proof, highlights), [proof, highlights])

  // After the overlay re-renders (proof or highlights changed) keep it aligned with the textarea so
  // a fresh ML result doesn't desync the underlines after the user has already scrolled.
  useEffect(() => {
    const textarea = proofTextareaRef.current
    if (!textarea) return
    syncOverlayScroll(textarea)
  }, [proof, highlights])

  return (
    <section className="flex h-full w-full flex-col gap-5 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
          Statement to prove
        </label>
        <input
          value={statement}
          onChange={(event) => onStatementChange(event.target.value)}
          onBeforeInput={onStatementBeforeInput}
          disabled={disabled}
          type="text"
          placeholder="e.g. f(x) = x^2 is a bijection on the non-negative reals."
          className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-lg font-semibold text-white placeholder:text-gray-500 focus:border-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
          Proof
        </label>
        <div
          className={`relative flex-1 min-h-[400px] overflow-hidden rounded-md border bg-black/20 transition-colors ${
            disabled ? 'border-white/5 opacity-60' : 'border-white/10 focus-within:border-blue-400'
          }`}
        >
          {/* Outer overlay clips against the container edges; the inner ref is translated to mirror
              the textarea's scrollTop so highlight spans stay attached to their characters. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              aria-hidden
              ref={overlayContentRef}
              className="whitespace-pre-wrap break-words px-3 py-2 font-mono text-[15px] leading-6 text-transparent will-change-transform"
            >
              {segments.map((segment, index) => {
                if (segment.highlightId === null) {
                  return <span key={index}>{segment.text}</span>
                }
                const isActive = segment.highlightId === activeHighlightId
                return (
                  <span
                    key={index}
                    data-error-id={segment.highlightId}
                    className="rounded-sm"
                    style={{
                      backgroundColor: isActive
                        ? 'rgba(248, 113, 113, 0.35)'
                        : 'rgba(248, 113, 113, 0.18)',
                      textDecoration: 'underline',
                      textDecorationStyle: 'wavy',
                      textDecorationColor: '#f87171',
                      textDecorationSkipInk: 'none',
                    }}
                  >
                    {segment.text}
                  </span>
                )
              })}
              {/* Trailing newline trick: ensures the underlay matches textarea when the proof ends with a newline. */}
              {proof.endsWith('\n') ? <span>{'\u200B'}</span> : null}
            </div>
          </div>

          <textarea
            ref={proofTextareaRef}
            value={proof}
            onBeforeInput={onProofBeforeInput}
            onChange={(event) => onProofChange(event.target.value)}
            onScroll={(event) => syncOverlayScroll(event.currentTarget)}
            disabled={disabled}
            placeholder="Start drafting your proof here."
            spellCheck={false}
            className="relative h-full w-full resize-none whitespace-pre-wrap break-words bg-transparent px-3 py-2 font-mono text-[15px] leading-6 text-gray-100 caret-blue-300 placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </section>
  )
})

export default Editor
