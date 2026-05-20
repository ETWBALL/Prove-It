'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type DashboardDocument = {
  publicId: string
  title: string
  lastEdited?: string
  numErrors?: number
}

type GetDocumentsResponse = {
  documents?: DashboardDocument[]
  error?: string
}

type CreateDocumentResponse = {
  document?: {
    publicId: string
    title: string
    lastEdited?: string
    numErrors?: number
  }
  error?: string
}

export default function DashboardPage() {
  const router = useRouter()

  const [documents, setDocuments] = useState<DashboardDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [newTitle, setNewTitle] = useState('Untitled Proof')
  const [createdDocument, setCreatedDocument] = useState<DashboardDocument | null>(null)

  async function fetchDocuments() {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/v1/documents', {
        method: 'GET',
        credentials: 'include',
      })
      const body = (await response.json()) as GetDocumentsResponse

      if (!response.ok) {
        setErrorMessage(body.error ?? 'Failed to load documents')
        setDocuments([])
        return
      }

      setDocuments(body.documents ?? [])
    } catch {
      setErrorMessage('Network error while loading documents')
      setDocuments([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchDocuments()
  }, [])

  async function createDocument() {
    setIsCreating(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/v1/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: newTitle.trim() || 'Untitled Proof',
        }),
      })

      const body = (await response.json()) as CreateDocumentResponse
      if (!response.ok || !body.document?.publicId) {
        setErrorMessage(body.error ?? 'Failed to create document')
        return
      }

      const created: DashboardDocument = {
        publicId: body.document.publicId,
        title: body.document.title,
        lastEdited: body.document.lastEdited,
        numErrors: body.document.numErrors ?? 0,
      }

      setDocuments((prev) => [created, ...prev])
      setCreatedDocument(created)
    } catch {
      setErrorMessage('Network error while creating document')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-100">Test Dashboard</h1>
        <p className="text-sm text-gray-400">
          Testing page: fetches your docs from <code>/api/v1/documents</code> and lets you create
          one quickly.
        </p>
      </header>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5">
        <label className="block text-sm text-gray-300">
          New document title
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-gray-100 outline-none focus:border-blue-400"
          />
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={createDocument}
            disabled={isCreating}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? 'Creating...' : 'Create Document'}
          </button>

          <button
            type="button"
            onClick={() => void fetchDocuments()}
            disabled={isLoading}
            className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh List
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-medium text-gray-100">Your Documents</h2>

        {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

        {isLoading ? (
          <p className="text-sm text-gray-300">Loading documents...</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-gray-300">
            You don&apos;t own any documents yet. Create one above.
          </p>
        ) : (
          <div className="grid gap-3">
            {documents.map((doc) => (
              <button
                key={doc.publicId}
                type="button"
                onClick={() => router.push(`/editor/${doc.publicId}`)}
                className="rounded-md border border-white/10 bg-black/20 p-4 text-left transition hover:border-blue-400 hover:bg-black/30"
              >
                <p className="font-medium text-gray-100">{doc.title}</p>
                <p className="mt-1 text-xs text-gray-400">publicId: {doc.publicId}</p>
                <p className="mt-1 text-xs text-gray-400">errors: {doc.numErrors ?? 0}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      {createdDocument ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-5">
            <h3 className="text-lg font-semibold text-gray-100">Document Created</h3>
            <p className="mt-2 text-sm text-gray-300">{createdDocument.title}</p>
            <p className="mt-1 text-xs text-gray-400">publicId: {createdDocument.publicId}</p>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => router.push(`/editor/${createdDocument.publicId}`)}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
              >
                Open in Editor
              </button>
              <button
                type="button"
                onClick={() => setCreatedDocument(null)}
                className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
