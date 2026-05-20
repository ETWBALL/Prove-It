'use client'

type SuggestionState = {
  suggestionContent: string
  startIndexSuggestion: number
  endIndexSuggestion: number
}

export type ErrorState = {
  // Server-side rows have a publicId; ML-produced errors don't yet — fall back to an in-memory clientId.
  publicId?: string
  clientId: string
  errorMessage: string
  errortype: string
  problematicContent?: string
  startIndexError: number
  endIndexError: number
  suggestion: SuggestionState | null
  MLTriggered: boolean
}

type ErrorPanelProps = {
  errors: ErrorState[]
  activeErrorId: string | null
  onSelectError: (error: ErrorState) => void
}

// LOGIC_CHAIN errors are surfaced as "critical"; the grammar / surface-level set is "warning".
// Keep this in lockstep with apps/websocket/lib/helpers.ts ``LOGIC_CHAIN_ERROR_TYPES``.
const LOGIC_CHAIN_ERROR_TYPES = new Set<string>([
  'INCORRECT_NEGATION',
  'ASSUMING_THE_CONVERSE',
  'EQUIVOCATION',
  'FALSE_DICHOTOMY_IN_CASE_ANALYSIS',
  'UNJUSTIFIED_REVERSIBILITY',
  'MISAPPLYING_A_THEOREM',
  'MISAPPLYING_A_DEFINITION',
  'MISAPPLYING_A_LEMMA',
  'MISAPPLYING_A_PROPERTY',
  'MISAPPLYING_AN_AXIOM',
  'MISAPPLYING_A_COROLLARY',
  'MISAPPLYING_A_CONJECTURE',
  'MISAPPLYING_A_PROPOSITION',
  'AFFIRMING_THE_CONSEQUENT',
  'CIRCULAR_REASONING',
  'JUMPING_TO_CONCLUSIONS',
  'IMPROPER_GENERALIZATION',
  'IMPLICIT_ASSUMPTION',
  'CONTRADICTS_PREVIOUS_STATEMENT',
  'SCOPE_ERROR',
  'NON_SEQUITUR',
  'VACUOUS_PROOF_FALLACY',
  'EXISTENTIAL_INSTANTIATION_ERROR',
  'ASSUMING_THE_GOAL',
  'VARIABLE_SHADOWING',
  'PROOF_BY_EXAMPLE',
  'ILLEGAL_OPERATION',
  'VACUOUS_NEGATION',
  'STRUCTURE_ERROR',
])

function humanizeErrorType(errortype: string): string {
  return errortype
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

export default function ErrorPanel({ errors, activeErrorId, onSelectError }: ErrorPanelProps) {
  const visibleErrors = errors.filter((error) => !error.MLTriggered)

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/5">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-white">Errors Detected</h2>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-gray-200">
            {visibleErrors.length}
          </span>
        </div>
        <span className="flex items-center gap-1 text-xs font-medium text-amber-300">
          <span aria-hidden>⚠</span>
          Review All
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {visibleErrors.length === 0 ? (
          <p className="text-sm text-gray-400">
            No active errors detected. Keep writing — we&apos;ll flag issues as they appear.
          </p>
        ) : (
          <ul className="space-y-3">
            {visibleErrors.map((error) => {
              const isCritical = LOGIC_CHAIN_ERROR_TYPES.has(error.errortype)
              const isActive = error.clientId === activeErrorId
              const baseTint = isCritical
                ? 'border-red-400/30 bg-red-500/10 hover:bg-red-500/15'
                : 'border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/15'
              const activeTint = isCritical
                ? 'border-red-300/60 bg-red-500/20 ring-1 ring-red-300/40'
                : 'border-amber-300/60 bg-amber-500/20 ring-1 ring-amber-300/40'
              const iconColor = isCritical ? 'text-red-300' : 'text-amber-300'

              return (
                <li key={error.clientId}>
                  <button
                    type="button"
                    onClick={() => onSelectError(error)}
                    className={`group flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition ${
                      isActive ? activeTint : baseTint
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 text-lg ${iconColor}`} aria-hidden>
                        {isCritical ? '⊗' : '⚠'}
                      </span>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold text-white">
                          {humanizeErrorType(error.errortype)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Chars {error.startIndexError}–{error.endIndexError}
                        </p>
                      </div>
                      <span className="text-gray-500 transition group-hover:text-gray-300" aria-hidden>
                        ›
                      </span>
                    </div>

                    {error.errorMessage ? (
                      <p className="text-sm text-gray-200">{error.errorMessage}</p>
                    ) : null}

                    {error.problematicContent ? (
                      <p className="rounded-md border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs text-red-200">
                        “{error.problematicContent}”
                      </p>
                    ) : null}

                    {error.suggestion?.suggestionContent ? (
                      <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs">
                        <p className="mb-0.5 font-semibold uppercase tracking-wide text-emerald-200">
                          Suggestion
                        </p>
                        <p className="text-emerald-100">{error.suggestion.suggestionContent}</p>
                      </div>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
