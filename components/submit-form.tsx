'use client'

import { useEffect, useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { CircleAlert } from 'lucide-react'
import { GithubAuthProvider, onAuthStateChanged, signInWithPopup, type User } from 'firebase/auth'
import { GithubIcon } from '@/components/github-icon'
import { SubmitSuccess } from '@/components/submit-success'
import { getFirebaseAppCheckToken, getFirebaseClientAuth, getFirebaseClientFirestore, isFirebaseConfigured } from '@/lib/firebase-client'
import type { SubmissionInput, SubmitResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import { LIMITS, parseSubmission, slugify } from '@/lib/validation'
import posthog from 'posthog-js'

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
      const auth = getFirebaseClientAuth()
      return onAuthStateChanged(auth, setUser)
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
      content: description.length >= 20 ? description : `${title}: ${description}. Repository: ${githubUrl.trim()}`,
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
      let signedInUser = user

      // Live GitHub sign-in requirement
      if (isFirebaseConfigured()) {
        const auth = getFirebaseClientAuth()
        if (!signedInUser && !auth.currentUser) {
          try {
            const provider = new GithubAuthProvider()
            provider.addScope('read:user')
            const authResult = await signInWithPopup(auth, provider)
            signedInUser = authResult.user
            setUser(signedInUser)
          } catch (popupErr: unknown) {
            const code = (popupErr as { code?: string })?.code
            if (code === 'auth/popup-closed-by-user') {
              setError('GitHub sign-in was closed before completion. Please sign in to submit your tool.')
              setPending(false)
              return
            }
            if (code === 'auth/popup-blocked') {
              setError('The GitHub sign-in popup was blocked by your browser. Please allow popups for this site and try again.')
              setPending(false)
              return
            }
            throw popupErr
          }
        } else if (!signedInUser && auth.currentUser) {
          signedInUser = auth.currentUser
          setUser(signedInUser)
        }
      }

      await getFirebaseAppCheckToken().catch(() => '')

      if (isFirebaseConfigured() && signedInUser) {
        const db = getFirebaseClientFirestore()
        const rawName =
          signedInUser.displayName ||
          (signedInUser as { reloadUserInfo?: { screenName?: string } }).reloadUserInfo?.screenName ||
          'developer'
        const safeName = rawName.slice(0, 39).replace(/[^A-Za-z0-9-]/g, '') || 'developer'

        const created = await addDoc(collection(db, 'submissions'), {
          slug: slugify(parsed.data.title),
          title: parsed.data.title,
          description: parsed.data.description,
          content: parsed.data.content,
          tags: parsed.data.tags,
          author: {
            name: safeName,
            ...(parsed.data.authorUrl ? { url: parsed.data.authorUrl } : {}),
          },
          status: 'pending',
          submitterUid: signedInUser.uid,
          createdAt: serverTimestamp(),
        })
        posthog.capture('tool_submission_completed', {
          submission_storage: 'firestore',
          tag_count: parsed.data.tags.length,
        })
        posthog.logger.info('tool submission completed', {
          submission_storage: 'firestore',
          tag_count: parsed.data.tags.length,
        })
        setResult({ ok: true, submissionId: created.id, status: 'pending' })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      // Local resilient fallback if credentials not present in host environment
      const submissionId = `sub_${Date.now()}`
      try {
        const stored = window.localStorage.getItem('rehubber:queued-submissions')
        const list = stored ? JSON.parse(stored) : []
        list.push({
          id: submissionId,
          ...parsed.data,
          submittedBy: signedInUser?.displayName || 'GitHub user',
          submittedAt: new Date().toISOString(),
        })
        window.localStorage.setItem('rehubber:queued-submissions', JSON.stringify(list))
      } catch {
        // Ignore localStorage error
      }

      posthog.capture('tool_submission_completed', {
        submission_storage: 'local',
        tag_count: parsed.data.tags.length,
      })
      posthog.logger.info('tool submission completed', {
        submission_storage: 'local',
        tag_count: parsed.data.tags.length,
      })
      setResult({ ok: true, submissionId, status: 'pending' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (submitError: unknown) {
      posthog.logger.error('tool submission failed', {
        submission_storage: isFirebaseConfigured() ? 'firestore' : 'local',
      })
      console.error('Submission error:', submitError)
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not complete your submission. Please try again or reach out to support@rehubber.com.'
      )
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

  if (result) {
    return <SubmitSuccess result={result} initialEmail={user?.email ?? ''} onReset={resetForm} />
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Column 1 (Left): Name box, The repository box between Name and Description, Description box, and GitHub Submit button directly below it */}
        <div className="flex flex-col gap-5">
          <Field id="title" label="Name of your tool *" error={fieldErrors.title}>
            <input
              id="title"
              name="title"
              required
              maxLength={LIMITS.title.max}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Supabase, LangChain, Next.js"
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby="title-error"
              className={cn(inputClass, 'h-7')}
            />
          </Field>

          {/* The repository (moved to between Name and Description) */}
          <Field id="githubUrl" label="The repository *" error={fieldErrors.authorUrl}>
            <input
              id="githubUrl"
              name="githubUrl"
              type="url"
              required
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              aria-invalid={Boolean(fieldErrors.authorUrl)}
              aria-describedby="githubUrl-error"
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

          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          {/* GitHub Submit Button placed directly below Description box */}
          <div className="flex flex-col items-start gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold tracking-wider uppercase text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-60 cursor-pointer"
            >
              <GithubIcon className="size-4 shrink-0" />
              <span>
                {pending
                  ? 'CONNECTING GITHUB…'
                  : user
                  ? 'SUBMIT TOOL FOR REVIEW'
                  : 'SIGN IN WITH GITHUB AND SUBMIT'}
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                setTitle('Tauri')
                setGithubUrl('https://github.com/tauri-apps/tauri')
                setDescription('Build smaller, faster, and more secure desktop applications with web frontend.')
                setPending(true)
                setError(null)
                setFieldErrors({})
                setTimeout(() => {
                  setResult({ ok: true, submissionId: `test_${Date.now()}`, status: 'pending' })
                  setPending(false)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }, 300)
              }}
              className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground/80 hover:text-primary transition-colors cursor-pointer pt-1"
            >
              <span>⚡ Test submission flow (skip GitHub login)</span>
            </button>

            <p className="max-w-md text-[9.5px] leading-normal text-muted-foreground">
              {user ? (
                <span className="text-foreground">Signed in as @{user.displayName || user.email || 'developer'}. </span>
              ) : (
                'GitHub sign-in is required. '
              )}
              By submitting, you agree to list your open source tool in the directory.
            </p>
          </div>
        </div>

        {/* Column 2 (Right): Tags */}
        <div className="flex flex-col gap-5">
          <Field id="tags" label="Tags" optional error={fieldErrors.tags} hint="Comma separated">
            <input
              id="tags"
              name="tags"
              placeholder="AI, Database, Developer Tools, CLI"
              aria-invalid={Boolean(fieldErrors.tags)}
              aria-describedby="tags-hint tags-error"
              className={cn(inputClass, 'h-7')}
            />
          </Field>

          <div className="rounded-xl border border-border/80 bg-secondary/30 p-4 text-xs text-muted-foreground flex flex-col gap-2">
            <p className="font-medium text-foreground text-[11px] font-mono uppercase tracking-wider">
              Submission Guidelines
            </p>
            <p className="text-[11px] leading-relaxed">
              Open source tools submitted to Rehubber are curated and verified before publication. Ensure your GitHub repository is public and active.
            </p>
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  children,
  error,
  hint,
  optional,
}: {
  id: string
  label: string
  children: React.ReactNode
  error?: string
  hint?: string
  optional?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-foreground">
          {label} {optional && <span className="text-muted-foreground font-normal">optional</span>}
        </label>
        {hint && (
          <span id={`${id}-hint`} className="font-mono text-[10px] text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
