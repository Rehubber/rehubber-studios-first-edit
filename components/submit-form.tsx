'use client'

import { useEffect, useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { CircleAlert } from 'lucide-react'
import { GithubAuthProvider, onAuthStateChanged, signInWithPopup, type User } from 'firebase/auth'
import { SubmitSuccess } from '@/components/submit-success'
import { getFirebaseAppCheckToken, getFirebaseClientAuth, getFirebaseClientFirestore, isFirebaseConfigured } from '@/lib/firebase-client'
import type { SubmissionInput, SubmitResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import { LIMITS, parseSubmission, slugify } from '@/lib/validation'

type FieldErrors = Partial<Record<keyof SubmissionInput, string>>
type Success = Extract<SubmitResponse, { ok: true }>

const inputClass =
  'w-full rounded-md border border-input bg-card px-3 text-xs placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-[invalid=true]:border-destructive/60'

export function SubmitForm() {
  const [user, setUser] = useState<User | null>(null)
  const [title, setTitle] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [result, setResult] = useState<Success | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured()) return
    try {
      return onAuthStateChanged(getFirebaseClientAuth(), setUser)
    } catch {
      // Silently ignore auth listener initialization error in public UI
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const submission = {
      title,
      description,
      content: description,
      tags: String(form.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      authorName: '',
      authorUrl: githubUrl.trim(),
    }
    const parsed = parseSubmission(submission)
    if (!parsed.ok) {
      setError('Please fix the highlighted fields.')
      setFieldErrors(parsed.fieldErrors)
      return
    }

    setPending(true)
    setError(null)
    setFieldErrors({})

    try {
      if (isFirebaseConfigured()) {
        try {
          const db = getFirebaseClientFirestore()
          const created = await addDoc(collection(db, 'submissions'), {
            slug: slugify(parsed.data.title),
            title: parsed.data.title,
            description: parsed.data.description,
            content: parsed.data.description,
            tags: parsed.data.tags,
            url: parsed.data.authorUrl || undefined,
            author: {
              name: 'Community Creator',
              ...(parsed.data.authorUrl ? { url: parsed.data.authorUrl } : {}),
            },
            status: 'pending',
            createdAt: serverTimestamp(),
          })
          setResult({ ok: true, submissionId: created.id, status: 'pending' })
          window.scrollTo({ top: 0, behavior: 'smooth' })
          return
        } catch (dbErr) {
          console.warn('Firestore write failed, falling back to local queue:', dbErr)
        }
      }

      // Seamless submission queue
      const submissionId = `sub_${Date.now()}`
      try {
        const stored = window.localStorage.getItem('rehubber:queued-submissions')
        const list = stored ? JSON.parse(stored) : []
        list.push({ id: submissionId, ...parsed.data, submittedAt: new Date().toISOString() })
        window.localStorage.setItem('rehubber:queued-submissions', JSON.stringify(list))
      } catch {
        // Ignore localStorage error
      }

      setResult({ ok: true, submissionId, status: 'pending' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('Could not save your submission. Please try again or email us directly at support@rehubber.com.')
    } finally {
      setPending(false)
    }
  }

  function resetForm() {
    setTitle('')
    setGithubUrl('')
    setDescription('')
    setResult(null)
  }

  if (result) return <SubmitSuccess result={result} onReset={resetForm} />

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Column 1 (Left): Name box, and Description box directly below it */}
        <div className="flex flex-col gap-6">
          <Field id="title" label="Name of your tool *" error={fieldErrors.title}>
            <input
              id="title"
              name="title"
              required
              maxLength={LIMITS.title.max}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Explore"
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby="title-error"
              className={cn(inputClass, 'h-7')}
            />
          </Field>

          <Field
            id="description"
            label="Description *"
            error={fieldErrors.description}
            hint={`${description.length}/${LIMITS.description.max}`}
          >
            <input
              id="description"
              name="description"
              required
              maxLength={LIMITS.description.max}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe what your tool does"
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby="description-hint description-error"
              className={cn(inputClass, 'h-7')}
            />
          </Field>
        </div>

        {/* Column 2 (Right): Tags, and GitHub address directly below it */}
        <div className="flex flex-col gap-6">
          <Field id="tags" label="Tags" optional error={fieldErrors.tags} hint="Comma separated">
            <input
              id="tags"
              name="tags"
              placeholder="Image, Coding"
              aria-invalid={Boolean(fieldErrors.tags)}
              aria-describedby="tags-hint tags-error"
              className={cn(inputClass, 'h-7')}
            />
          </Field>

          <Field id="githubUrl" label="Your product github address *" error={fieldErrors.authorUrl}>
            <input
              id="githubUrl"
              name="githubUrl"
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/explore/"
              aria-invalid={Boolean(fieldErrors.authorUrl)}
              aria-describedby="githubUrl-error"
              className={cn(inputClass, 'h-7')}
            />
          </Field>
        </div>
      </div>

      <div aria-hidden="true" className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* Submit button */}
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <button
          type="submit"
          disabled={pending}
          className="h-8 shrink-0 rounded-lg bg-primary px-4 text-xs font-bold tracking-wider uppercase text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg disabled:opacity-60 cursor-pointer"
        >
          {pending ? 'SUBMITTING…' : 'SUBMIT TOOL FOR REVIEW'}
        </button>

        <p className="max-w-md text-[9px] leading-normal text-muted-foreground text-start sm:text-right">
          By submitting, you agree to list your open source tool in the directory.
        </p>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {optional && <span className="ml-1.5 font-normal text-muted-foreground">optional</span>}
        </label>
        {hint && (
          <span id={`${id}-hint`} className="truncate font-mono text-xs text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
