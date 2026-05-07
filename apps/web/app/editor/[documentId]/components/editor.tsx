'use client'

import { FormEvent } from 'react'

type EditorProps = {
  statement: string
  proof: string
  disabled?: boolean
  onStatementChange: (value: string) => void
  onProofChange: (value: string) => void
  onProofBeforeInput: (event: FormEvent<HTMLTextAreaElement>) => void
}

export default function Editor({
  statement,
  proof,
  disabled = false,
  onStatementChange,
  onProofChange,
  onProofBeforeInput,
}: EditorProps) {
  return (
    <section className="w-full rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
      <input
        value={statement}
        onChange={(event) => onStatementChange(event.target.value)}
        disabled={disabled}
        type="text"
        placeholder="Statement to prove..."
        className="mb-5 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-lg font-semibold text-white placeholder:text-gray-400 focus:border-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />

      <textarea
        value={proof}
        onBeforeInput={onProofBeforeInput}
        onChange={(event) => onProofChange(event.target.value)}
        disabled={disabled}
        rows={14}
        placeholder="Start drafting your proof here."
        className="w-full resize-y rounded-md border border-white/10 bg-black/20 px-3 py-2 text-gray-100 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />
    </section>
  )
}
