'use client'

type MathStatementType =
  | 'DEFINITION'
  | 'THEOREM'
  | 'LEMMA'
  | 'PROPERTY'
  | 'AXIOM'
  | 'COROLLARY'
  | 'CONJECTURE'
  | 'PROPOSITION'

export type MathStatement = {
  publicId: string
  type: MathStatementType
  name: string
  content: string
  hint?: string | null
  textbook?: string
  orderIndex?: number
}

type MathStatementsPanelProps = {
  statements: MathStatement[]
}

// Color tokens per statement type so users can scan the right rail and immediately tell apart
// a definition from a theorem at a glance.
const TYPE_STYLES: Record<MathStatementType, { label: string; badge: string }> = {
  DEFINITION: {
    label: 'definition',
    badge: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30',
  },
  THEOREM: {
    label: 'theorem',
    badge: 'bg-sky-500/20 text-sky-200 border border-sky-400/30',
  },
  LEMMA: {
    label: 'lemma',
    badge: 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30',
  },
  PROPERTY: {
    label: 'property',
    badge: 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30',
  },
  AXIOM: {
    label: 'axiom',
    badge: 'bg-violet-500/20 text-violet-200 border border-violet-400/30',
  },
  COROLLARY: {
    label: 'corollary',
    badge: 'bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/30',
  },
  CONJECTURE: {
    label: 'conjecture',
    badge: 'bg-amber-500/20 text-amber-200 border border-amber-400/30',
  },
  PROPOSITION: {
    label: 'proposition',
    badge: 'bg-rose-500/20 text-rose-200 border border-rose-400/30',
  },
}

export default function MathStatementsPanel({ statements }: MathStatementsPanelProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/5">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-white">Definitions &amp; Theorems</h2>
          <p className="text-xs text-gray-400">Math statements relevant to your proof.</p>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-gray-200">
          {statements.length}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {statements.length === 0 ? (
          <p className="text-sm text-gray-400">
            No math statements selected yet. Once you finalize the statement you&apos;re proving,
            relevant definitions will appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {statements.map((statement) => {
              const styles = TYPE_STYLES[statement.type] ?? TYPE_STYLES.DEFINITION
              return (
                <li
                  key={statement.publicId || statement.name}
                  className="rounded-xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles.badge}`}
                    >
                      {styles.label}
                    </span>
                    <h3 className="text-sm font-semibold text-white">{statement.name}</h3>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-200">
                    {statement.content}
                  </p>

                  {statement.hint ? (
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <p className="text-xs italic leading-5 text-gray-400">
                        <span className="font-semibold not-italic text-gray-300">Hint:</span>{' '}
                        {statement.hint}
                      </p>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
