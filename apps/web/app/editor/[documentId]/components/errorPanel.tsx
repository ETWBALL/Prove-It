'use client'

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

type ErrorPanelProps = {
  errors: ErrorState[]
}

export default function ErrorPanel({ errors }: ErrorPanelProps) {
  return (
    <aside className="w-full rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">Detected errors</h2>

      {errors.length === 0 ? (
        <p className="text-sm text-gray-300">No active errors for this document.</p>
      ) : (
        <ul className="space-y-3">
          {errors.map((error) => (
            <li key={error.publicId} className="rounded-lg border border-red-400/30 bg-red-500/10 p-3">
              <p className="text-sm font-medium text-red-200">
                {error.errorContent || 'Untitled error'} ({error.startIndexError}-{error.endIndexError})
              </p>
              {error.suggestion ? (
                <p className="mt-1 text-xs text-gray-200">
                  Suggestion: {error.suggestion.suggestionContent} (
                  {error.suggestion.startIndexSuggestion}-{error.suggestion.endIndexSuggestion})
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
