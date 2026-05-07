'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type SignupSuccessResponse = {
  success: true
  message: string
  user: {
    publicId: string
    email: string
    name: string | null
    username: string | null
    bio: string | null
    avatarUrl: string | null
  }
}

type SignupErrorResponse = {
  error?: string | Record<string, string[]>
}

type UniversityOption = 'none' | 'uoft'

export default function SignupPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [universityOption, setUniversityOption] = useState<UniversityOption>('none')
  const [uoftUniversityId, setUoftUniversityId] = useState(
    process.env.NEXT_PUBLIC_UOFT_UNIVERSITY_ID ?? ''
  )
  const [documentId, setDocumentId] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusCode, setStatusCode] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [rawResponse, setRawResponse] = useState('')

  const universityId = useMemo(
    () => (universityOption === 'uoft' ? uoftUniversityId.trim() : ''),
    [universityOption, uoftUniversityId]
  )

  function formatError(error: SignupErrorResponse['error']): string {
    if (!error) return 'Signup failed'
    if (typeof error === 'string') return error

    const entries = Object.entries(error)
    if (entries.length === 0) return 'Signup failed'

    return entries
      .map(([field, messages]) => `${field}: ${(messages ?? []).join(', ')}`)
      .join(' | ')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatusCode(null)
    setStatusMessage('')
    setRawResponse('')

    try {
      const payload: {
        email: string
        password: string
        confirmPassword: string
        universityId?: string
      } = {
        email: email.trim(),
        password,
        confirmPassword,
      }

      if (universityId) payload.universityId = universityId

      const response = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        const errorMessage = formatError((body as SignupErrorResponse | null)?.error)
        setStatusMessage(errorMessage)
        return
      }

      const successBody = body as SignupSuccessResponse
      setStatusMessage(successBody.message || 'Signup successful')
    } catch {
      setStatusMessage('Network error while calling signup API')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-100">Test Signup</h1>
        <p className="text-sm text-gray-400">
          Dev-only form for hitting <code>/api/v1/auth/signup</code>. Successful signup should set
          auth cookies automatically.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5"
      >
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

        <label className="block text-sm text-gray-300">
          Confirm Password
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-gray-100 outline-none focus:border-blue-400"
          />
        </label>

        <label className="block text-sm text-gray-300">
          University
          <select
            value={universityOption}
            onChange={(e) => setUniversityOption(e.target.value as UniversityOption)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-gray-100 outline-none focus:border-blue-400"
          >
            <option value="none">None</option>
            <option value="uoft">University of Toronto</option>
          </select>
        </label>

        {universityOption === 'uoft' && (
          <label className="block text-sm text-gray-300">
            University of Toronto publicId
            <input
              type="text"
              placeholder="Paste University.publicId from Prisma Studio"
              value={uoftUniversityId}
              onChange={(e) => setUoftUniversityId(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-gray-100 outline-none focus:border-blue-400"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Signing up...' : 'Sign up'}
        </button>
      </form>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-gray-300">
          Status: {statusCode ?? '-'} {statusMessage ? `| ${statusMessage}` : ''}
        </p>
        <pre className="overflow-auto rounded-md bg-black/30 p-3 text-xs text-gray-300">
          {rawResponse || 'No response yet'}
        </pre>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-gray-300">
          Optional: jump to editor after signup/login when you have a document publicId.
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
