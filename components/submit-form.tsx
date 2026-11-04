'use client'

import { useEffect, useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { CircleAlert, GitBranch, GitPullRequest, LoaderCircle } from 'lucide-react'
import { GithubAuthProvider, onAuthStateChanged, signInWithPopup, type User } from 'firebase/auth'
import { SubmitSuccess } from '@/components/submit-success'
import { getFirebaseAppCheckToken, getFirebaseClientAuth, getFirebaseClientFirestore } from '@/lib/firebase-client'
import type { SubmissionInput, SubmitResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import { LIMITS, parseSubmission, slugify } from '@/lib/validation'

type FieldErrors = Partial<Record<keyof SubmissionInput, string>>
type Success = Extract<SubmitResponse, { ok: true }>

const RULES_PLACEHOLDER = `You are an expert in ...

Code Style
- ...

Best Practices
- ...`

const inputClass =
  'w-full rounded-lg border border-input bg-card px-3.5 text-sm placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive/60'

export function SubmitForm() {
  const [user, setUser] = useState<User | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [result, setResult] = useState<Success | null>(null)

  const slug = slugify(title)

  useEffect(() => {
    try {
      return onAuthStateChanged(getFirebaseClientAuth(), setUser)
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Firebase Authentication is not configured.')
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const submission = {
      title,
      description,
      content,
      tags: String(form.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      authorName: String(form.get('authorName') ?? '').replace(/^@/, ''),
      authorUrl: String(form.get('authorUrl') ?? ''),
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
      const auth = getFirebaseClientAuth()
      const signedInUser = auth.currentUser ?? (await signInWithPopup(auth, new GithubAuthProvider())).user
      await getFirebaseAppCheckToken()
      const created = await addDoc(collection(getFirebaseClientFirestore(), 'submissions'), {
        slug: slugify(parsed.data.title),
        title: parsed.data.title,
        description: parsed.data.description,
        content: parsed.data.content,
        tags: parsed.data.tags,
        author: {
          name: parsed.data.authorName || 'anonymous',
          ...(parsed.data.authorUrl ? { url: parsed.data.authorUrl } : {}),
        },
        status: 'pending',
        submitterUid: signedInUser.uid,
        createdAt: serverTimestamp(),
      })
      setUser(signedInUser)
      setResult({ ok: true, submissionId: created.id, status: 'pending' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save your submission. Please try again.')
    } finally {
      setPending(false)
    }
  }

  function resetForm() {
    setTitle('')
    setDescription('')
    setContent('')
    setResult(null)
  }

  if (result) return <SubmitSuccess result={result} onReset={resetForm} />

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="title" label="Framework title" error={fieldErrors.title} hint={slug ? `content/rules/${slug}.json` : 'e.g. Next.js App Router'}>
          <input
            id="title"
            name="title"
            required
            maxLength={LIMITS.title.max}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Next.js App Router"
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby="title-hint title-error"
            className={cn(inputClass, 'h-11')}
          />
        </Field>

        <Field id="tags" label="Tags" optional error={fieldErrors.tags} hint="Comma separated, up to 5">
          <input
            id="tags"
            name="tags"
            placeholder="React, TypeScript"
            aria-invalid={Boolean(fieldErrors.tags)}
            aria-describedby="tags-hint tags-error"
            className={cn(inputClass, 'h-11')}
          />
        </Field>
      </div>

      <Field
        id="description"
        label="Description"
        error={fieldErrors.description}
        hint={`${description.length}/${LIMITS.description.max}`}
      >
        <textarea
          id="description"
          name="description"
          required
          rows={2}
          maxLength={LIMITS.description.max}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this ruleset help developers do?"
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby="description-hint description-error"
          className={cn(inputClass, 'resize-none py-3 leading-relaxed')}
        />
      </Field>

      <Field id="content" label="Rules instructions" error={fieldErrors.content} hint={`${content.split('\n').length} lines`}>
        <div className="overflow-hidden rounded-lg border border-input bg-code focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring has-[[aria-invalid=true]]:border-destructive/60">
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-2">
            <span aria-hidden="true" className="size-2 rounded-full bg-muted-foreground/30" />
            <span className="font-mono text-xs text-muted-foreground">.cursorrules</span>
          </div>
          <textarea
            id="content"
            name="content"
            required
            rows={14}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault()
                const el = e.currentTarget
                const { selectionStart, selectionEnd } = el
                const next = `${content.slice(0, selectionStart)}  ${content.slice(selectionEnd)}`
                setContent(next)
                requestAnimationFrame(() => el.setSelectionRange(selectionStart + 2, selectionStart + 2))
              }
            }}
            placeholder={RULES_PLACEHOLDER}
            spellCheck={false}
            aria-invalid={Boolean(fieldErrors.content)}
            aria-describedby="content-hint content-error"
            className="block w-full resize-y bg-transparent px-3.5 py-3 font-mono text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
      </Field>

      <fieldset className="grid gap-6 rounded-xl border border-border p-5 sm:grid-cols-2">
        <legend className="px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">Credit (optional)</legend>
        <Field id="authorName" label="GitHub username" optional error={fieldErrors.authorName}>
          <input
            id="authorName"
            name="authorName"
            placeholder="octocat"
            autoComplete="username"
            aria-invalid={Boolean(fieldErrors.authorName)}
            aria-describedby="authorName-error"
            className={cn(inputClass, 'h-11')}
          />
        </Field>
        <Field id="authorUrl" label="Profile link" optional error={fieldErrors.authorUrl}>
          <input
            id="authorUrl"
            name="authorUrl"
            type="url"
            placeholder="https://github.com/octocat"
            aria-invalid={Boolean(fieldErrors.authorUrl)}
            aria-describedby="authorUrl-error"
            className={cn(inputClass, 'h-11')}
          />
        </Field>
      </fieldset>

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

      <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {user ? `Signed in as ${user.displayName ?? user.email ?? 'GitHub user'}. ` : 'GitHub sign-in is required. '}
          By submitting, you agree to license your rule under MIT.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            user ? <GitPullRequest className="size-4" aria-hidden="true" /> : <GitBranch className="size-4" aria-hidden="true" />
          )}
          {pending ? 'Sending for review…' : user ? 'Submit for review' : 'Sign in with GitHub and submit'}
        </button>
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
    <div className="flex flex-col gap-2">
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
