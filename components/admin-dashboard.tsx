'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { GithubAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { Check, GitBranch, LoaderCircle, LogOut, ShieldAlert, X } from 'lucide-react'
import { getFirebaseAppCheckToken, getFirebaseClientAuth, getFirebaseClientFirestore } from '@/lib/firebase-client'
import type { PendingSubmission, SubmissionInput } from '@/lib/types'
import { parseSubmission, slugify } from '@/lib/validation'

function toPendingSubmission(id: string, data: DocumentData): PendingSubmission {
  const createdAt = typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate().toISOString() : null
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : '',
    content: typeof data.content === 'string' ? data.content : '',
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    authorName: typeof data.author?.name === 'string' ? data.author.name : 'anonymous',
    authorUrl: typeof data.author?.url === 'string' ? data.author.url : '',
    createdAt,
  }
}

function isPermissionError(error: unknown) {
  return error instanceof Error && (error.message.includes('permission') || error.message.includes('insufficient'))
}

export function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([])
  const [authReady, setAuthReady] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notModerator, setNotModerator] = useState(false)

  async function loadSubmissions(currentUser: User) {
    setError(null)
    setNotModerator(false)
    try {
      await getFirebaseAppCheckToken()
      const queue = query(
        collection(getFirebaseClientFirestore(), 'submissions'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(50),
      )
      const snapshot = await getDocs(queue)
      setSubmissions(snapshot.docs.map((submission) => toPendingSubmission(submission.id, submission.data())))
    } catch (loadError) {
      setSubmissions([])
      if (isPermissionError(loadError)) {
        setNotModerator(true)
      } else {
        setError(loadError instanceof Error ? loadError.message : 'Could not load pending submissions.')
      }
    }
  }

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), (nextUser) => {
        setUser(nextUser)
        setAuthReady(true)
        if (nextUser) {
          void loadSubmissions(nextUser)
        } else {
          setSubmissions([])
          setError(null)
          setNotModerator(false)
        }
      })
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Firebase Authentication is not configured.')
      setAuthReady(true)
    }

    return () => unsubscribe?.()
  }, [])

  async function handleSignIn() {
    setError(null)
    try {
      await signInWithPopup(getFirebaseClientAuth(), new GithubAuthProvider())
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'GitHub sign-in failed.')
    }
  }

  async function handleSignOut() {
    try {
      await signOut(getFirebaseClientAuth())
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not sign out.')
    }
  }

  async function moderate(submissionId: string, action: 'approve' | 'reject') {
    if (!user || busyId) return
    setBusyId(submissionId)
    setError(null)

    try {
      await getFirebaseAppCheckToken()
      const db = getFirebaseClientFirestore()
      const submissionRef = doc(db, 'submissions', submissionId)
      await runTransaction(db, async (transaction) => {
        const submissionSnapshot = await transaction.get(submissionRef)
        if (!submissionSnapshot.exists() || submissionSnapshot.data().status !== 'pending') {
          throw new Error('This submission is no longer pending. Refresh the queue.')
        }

        const data = submissionSnapshot.data()
        if (action === 'reject') {
          transaction.update(submissionRef, {
            status: 'rejected',
            moderatedAt: serverTimestamp(),
            moderatedBy: user.uid,
          })
          return
        }

        const parsed = parseSubmission({
          title: data.title,
          description: data.description,
          content: data.content,
          tags: data.tags,
          authorName: data.author?.name,
          authorUrl: data.author?.url,
        } satisfies Partial<SubmissionInput>)
        if (!parsed.ok) throw new Error('This stored submission is invalid and cannot be approved.')

        const slug = slugify(parsed.data.title)
        const publishedRef = doc(db, 'rules', slug)
        const publishedSnapshot = await transaction.get(publishedRef)
        if (publishedSnapshot.exists()) throw new Error('A published rule already uses this title.')

        transaction.set(publishedRef, {
          slug,
          title: parsed.data.title,
          description: parsed.data.description,
          content: parsed.data.content,
          tags: parsed.data.tags,
          author: {
            name: parsed.data.authorName || 'anonymous',
            ...(parsed.data.authorUrl ? { url: parsed.data.authorUrl } : {}),
          },
          status: 'published',
          upvotes: 0,
          source: 'approved-submission',
          sourceSubmissionId: submissionId,
          createdAt: data.createdAt ?? serverTimestamp(),
          approvedAt: serverTimestamp(),
        })
        transaction.update(submissionRef, {
          status: 'approved',
          moderatedAt: serverTimestamp(),
          moderatedBy: user.uid,
          approvedSlug: slug,
        })
      })
      setSubmissions((current) => current.filter((submission) => submission.id !== submissionId))
    } catch (moderationError) {
      if (isPermissionError(moderationError)) {
        setNotModerator(true)
      } else {
        setError(moderationError instanceof Error ? moderationError.message : 'Could not moderate the submission.')
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs uppercase tracking-wider text-primary">Admin</p>
          <h1 className="text-3xl font-semibold tracking-tight">Submission moderation</h1>
          <p className="text-sm text-muted-foreground">Review submissions before they appear in the public directory.</p>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.displayName ?? user.email ?? user.uid}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-secondary"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        )}
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {notModerator && user && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">This GitHub account is not authorized to moderate.</p>
          <p className="mt-1 text-muted-foreground">
            Add a Firestore document at <code>moderators/{user.uid}</code> with the boolean field <code>enabled: true</code>,
            then refresh this queue.
          </p>
        </div>
      )}

      {!authReady ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Checking sign-in…
        </div>
      ) : !user ? (
        <section className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
          <ShieldAlert className="size-8 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h2 className="font-medium">Moderator sign-in required</h2>
            <p className="text-sm text-muted-foreground">Sign in with the GitHub account enabled as a moderator.</p>
          </div>
          <button
            type="button"
            onClick={handleSignIn}
            className="flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <GitBranch className="size-4" aria-hidden="true" />
            Continue with GitHub
          </button>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
              Pending ({submissions.length})
            </h2>
            <button type="button" onClick={() => void loadSubmissions(user)} className="text-sm text-primary hover:underline">
              Refresh queue
            </button>
          </div>
          {submissions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
              No pending submissions.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {submissions.map((submission) => (
                <li key={submission.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-2">
                      <h3 className="text-lg font-semibold">{submission.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{submission.description}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {submission.authorName}
                        {submission.createdAt ? ` · ${new Date(submission.createdAt).toLocaleString()}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => void moderate(submission.id, 'approve')}
                        disabled={busyId !== null}
                        className="flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
                      >
                        {busyId === submission.id ? (
                          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Check className="size-4" aria-hidden="true" />
                        )}
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void moderate(submission.id, 'reject')}
                        disabled={busyId !== null}
                        className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-secondary disabled:opacity-60"
                      >
                        <X className="size-4" aria-hidden="true" />
                        Reject
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {submission.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {submission.authorUrl && (
                    <a href={submission.authorUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                      Submitter profile
                    </a>
                  )}
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-code p-4 font-mono text-xs leading-relaxed">
                    {submission.content}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  )
}
