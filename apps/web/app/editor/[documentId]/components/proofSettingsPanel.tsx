'use client'

type ProofSettingsPanelProps = {
  /** False until document:join:success — blocks all proof-settings websocket actions. */
  disabled: boolean
  settingsOpen: boolean
  onOpenSettings: () => void
  onCloseSettings: () => void
  onAddLemma: () => void
}

export default function ProofSettingsPanel({
  disabled,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
  onAddLemma,
}: ProofSettingsPanelProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-white">Proof settings</h2>
        <p className="text-xs text-gray-400">
          {disabled
            ? 'Join the document to change proof type, lemmas, and statements.'
            : settingsOpen
              ? 'Settings are open — ML analysis is paused.'
              : 'Configure proof type and selected statements.'}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpenSettings}
          disabled={disabled || settingsOpen}
          className="rounded-md border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Open settings
        </button>
        <button
          type="button"
          onClick={onCloseSettings}
          disabled={disabled || !settingsOpen}
          className="rounded-md border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Close settings
        </button>
        <button
          type="button"
          onClick={onAddLemma}
          disabled={disabled}
          className="rounded-md border border-indigo-400/30 bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-100 transition hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add lemma
        </button>
      </div>
    </section>
  )
}
