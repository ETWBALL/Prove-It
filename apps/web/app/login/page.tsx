'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type LoginSuccessResponse = {
  success: true
  message: string
}

type LoginErrorResponse = {
  error?: string | Record<string, string[]>
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [documentId, setDocumentId] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusCode, setStatusCode] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [rawResponse, setRawResponse] = useState('')

  function formatError(error: LoginErrorResponse['error']): string {
    if (!error) return 'Login failed'
    if (typeof error === 'string') return error

    const entries = Object.entries(error)
    if (entries.length === 0) return 'Login failed'

    return entries
      .map(([field, messages]) => `${field}: ${(messages ?? []).join(', ')}`)
      .join(' | ')
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setStatusCode(null)
    setStatusMessage('')
    setRawResponse('')

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
        credentials: 'include',
      })

      setStatusCode(response.status)

      let body: unknown = null
      try {
        body = await response.json()
      } catch {
        body = null
      }

      setRawResponse(JSON.stringify(body, null, 2))

      if (!response.ok) {
        const errorMessage = formatError((body as LoginErrorResponse | null)?.error)
        setStatusMessage(errorMessage)
        return
      }

      const successBody = body as LoginSuccessResponse
      setStatusMessage(successBody.message || 'Login successful')
    } catch {
      setStatusMessage('Network error while calling login API')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-100">Test Login</h1>
        <p className="text-sm text-gray-400">
          Dev-only form for testing <code>/api/v1/auth/login</code>. Successful login should set
          auth cookies automatically.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
        <label className="block text-sm text-gray-300">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-gray-100 outline-none focus:border-blue-400"
          />
        </label>

        <label className="block text-sm text-gray-300">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-gray-100 outline-none focus:border-blue-400"
          />
        </label>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Logging in...' : 'Log in'}
        </button>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-gray-300">
          Status: {statusCode ?? '-'} {statusMessage ? `| ${statusMessage}` : ''}
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          disabled={statusCode !== 200}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue to Dashboard
        </button>
        <pre className="overflow-auto rounded-md bg-black/30 p-3 text-xs text-gray-300">
          {rawResponse || 'No response yet'}
        </pre>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-gray-300">
          Optional: open editor after login when you have a document publicId.
        </p>
        <input
          type="text"
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          placeholder="document publicId"
          className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-gray-100 outline-none focus:border-blue-400"
        />
        <button
          type="button"
          onClick={() => router.push(`/editor/${documentId.trim()}`)}
          disabled={!documentId.trim()}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Open Editor
        </button>
      </section>
    </main>
  )
}