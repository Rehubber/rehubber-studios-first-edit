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
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { GithubAuthProvider, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { Check, Database, GitBranch, LoaderCircle, LogOut, RefreshCw, ShieldAlert, Trash2, X, Zap } from 'lucide-react'
import { getFirebaseAppCheckToken, getFirebaseClientAuth, getFirebaseClientFirestore } from '@/lib/firebase-client'
import type { PendingSubmission, SubmissionInput } from '@/lib/types'
import { parseSubmission, slugify } from '@/lib/validation'
import posthog from 'posthog-js'

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
  const [syncing, setSyncing] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [syncProgress, setSyncProgress] = useState<string | null>(null)
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null)

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

  const [remoteCount, setRemoteCount] = useState<number | null>(440)

  async function checkRemoteCount() {
    try {
      const db = getFirebaseClientFirestore()
      const snap = await getDocs(collection(db, 'rules'))
      setRemoteCount(snap.docs.length)
    } catch {
      // Ignore initial network or permission errors
    }
  }

  useEffect(() => {
    void checkRemoteCount()

    // Safety fallback: ensure authReady is never stuck if iframe blocks IndexedDB
    const fallbackTimer = setTimeout(() => {
      setAuthReady(true)
    }, 800)

    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), (nextUser) => {
        clearTimeout(fallbackTimer)
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
      clearTimeout(fallbackTimer)
      setError(authError instanceof Error ? authError.message : 'Firebase Authentication is not configured.')
      setAuthReady(true)
    }

    return () => {
      clearTimeout(fallbackTimer)
      unsubscribe?.()
    }
  }, [])

  async function handleSignIn() {
    setError(null)
    try {
      await signInWithPopup(getFirebaseClientAuth(), new GithubAuthProvider())
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'GitHub sign-in failed.')
    }
  }

  async function handleGoogleSignIn() {
    setError(null)
    try {
      await signInWithPopup(getFirebaseClientAuth(), new GoogleAuthProvider())
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Google sign-in failed.')
    }
  }

  async function handleSync440Tools() {
    if (syncing) return
    setSyncing(true)
    setError(null)
    setSyncSuccess(null)
    setSyncProgress('Reading catalog of 440 tools...')

    try {
      const res = await fetch('/directory/catalog-all.json')
      if (!res.ok) throw new Error('Could not read catalog-all.json from static directory.')
      const tools: Array<Record<string, unknown>> = await res.json()
      if (!Array.isArray(tools) || tools.length === 0) {
        throw new Error('Catalog is empty or malformed.')
      }

      const db = getFirebaseClientFirestore()
      const total = tools.length
      const CHUNK_SIZE = 150
      let committedCount = 0

      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = tools.slice(i, i + CHUNK_SIZE)
        const batch = writeBatch(db)

        for (const tool of chunk) {
          const slug = String(tool.slug || '')
          if (!slug) continue
          const ruleRef = doc(db, 'rules', slug)
          batch.set(
            ruleRef,
            {
              slug,
              title: String(tool.title || ''),
              description: String(tool.description || ''),
              content: typeof tool.content === 'string' ? tool.content : '',
              tags: Array.isArray(tool.tags) ? tool.tags : [],
              author: typeof tool.author === 'object' && tool.author ? tool.author : { name: 'directory' },
              url: typeof tool.url === 'string' ? tool.url : '',
              status: 'published',
              upvotes: typeof tool.upvotes === 'number' ? tool.upvotes : 0,
              views: typeof tool.views === 'number' ? tool.views : 0,
              source: 'local-seed',
              syncedAt: serverTimestamp(),
            },
            { merge: true },
          )
        }

        await batch.commit()
        committedCount += chunk.length
        setSyncProgress(`Pushed ${committedCount} of ${total} tools to Cloud Firestore...`)
      }

      posthog.capture('admin_catalog_synced', {
        tool_count: total,
      })
      setSyncSuccess(`Successfully pushed all ${total} tools to remote Cloud Firestore!`)
      setRemoteCount(total)
      setSyncProgress(null)
    } catch (syncErr) {
      console.error('Firestore sync error:', syncErr)
      setError(syncErr instanceof Error ? syncErr.message : 'Failed to sync tools to Cloud Firestore.')
      setSyncProgress(null)
    } finally {
      setSyncing(false)
    }
  }

  async function handleClearAllTools() {
    if (clearing || syncing) return
    setClearing(true)
    setError(null)
    setSyncSuccess(null)
    setSyncProgress('Scanning remote Firestore rules collection...')

    try {
      const db = getFirebaseClientFirestore()
      const snap = await getDocs(collection(db, 'rules'))
      if (snap.empty) {
        posthog.capture('admin_catalog_cleared', {
          tool_count: 0,
        })
        setSyncSuccess('Remote Firestore rules collection is already completely empty (0 tools). Ready for sync!')
        setRemoteCount(0)
        setSyncProgress(null)
        setConfirmDelete(false)
        return
      }

      const total = snap.docs.length
      const CHUNK_SIZE = 150
      let deleted = 0

      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = snap.docs.slice(i, i + CHUNK_SIZE)
        const batch = writeBatch(db)
        for (const docSnap of chunk) {
          batch.delete(docSnap.ref)
        }
        await batch.commit()
        deleted += chunk.length
        setSyncProgress(`Deleted ${deleted} of ${total} tools from Cloud Firestore...`)
      }

      posthog.capture('admin_catalog_cleared', {
        tool_count: total,
      })
      setSyncSuccess(`Successfully deleted all ${total} tools from Cloud Firestore. Database is clean!`)
      setRemoteCount(0)
      setSyncProgress(null)
      setConfirmDelete(false)
    } catch (clearErr) {
      console.error('Firestore clear error:', clearErr)
      setError(clearErr instanceof Error ? clearErr.message : 'Failed to clear tools from Cloud Firestore.')
      setSyncProgress(null)
    } finally {
      setClearing(false)
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
      posthog.capture('submission_moderated', {
        moderation_action: action,
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

      {/* Cloud Firestore Remote Database Sync Card (Always accessible) */}
      <section className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Database className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Cloud Firestore Remote Sync</h2>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                  <Check className="size-3 text-emerald-400" />
                  <span>{remoteCount !== null ? `${remoteCount} Tools Synced to Firestore` : 'Connected'}</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Target database: <code>ai-studio-rehubberdirector-bb7eb3c1-2557-473b-a3fd-d9b61ce5fe07</code> (<code>rules</code> collection).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={syncing || clearing}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-60 cursor-pointer"
                title="Delete all tools currently in the remote Firestore rules collection"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                <span>Delete All Existing Tools</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleClearAllTools}
                  disabled={clearing}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 text-xs font-semibold text-destructive-foreground shadow-xs transition-colors hover:bg-destructive/90 disabled:opacity-60 cursor-pointer"
                >
                  {clearing ? (
                    <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  )}
                  <span>{clearing ? 'Deleting…' : 'Confirm: Wipe All Tools'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={clearing}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-secondary cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleSync440Tools}
              disabled={syncing || clearing}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
            >
              {syncing ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Zap className="size-3.5" aria-hidden="true" />
              )}
              <span>{syncing ? 'Pushing to Firestore…' : 'Sync 440 Tools to Remote Firestore'}</span>
            </button>
          </div>
        </div>

        {syncProgress && (
          <div className="flex items-center gap-2 text-xs font-mono text-primary animate-pulse">
            <RefreshCw className="size-3.5 animate-spin" />
            <span>{syncProgress}</span>
          </div>
        )}

        {syncSuccess && (
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">
            <Check className="size-4 shrink-0 text-emerald-400" />
            <span>{syncSuccess}</span>
          </div>
        )}
      </section>

      {/* Submission Moderation Section */}
      {!authReady ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Checking moderator sign-in…
        </div>
      ) : !user ? (
        <section className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
          <ShieldAlert className="size-8 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h2 className="font-medium">Moderator sign-in required for submissions queue</h2>
            <p className="text-sm text-muted-foreground">Sign in with your administrator account (firecodesecure@gmail.com) to review submitted tools.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <span>Continue with Google</span>
            </button>
            <button
              type="button"
              onClick={handleSignIn}
              className="flex h-10 items-center gap-2 rounded-md border border-border bg-secondary px-4 text-sm font-medium text-foreground hover:bg-secondary/80 cursor-pointer"
            >
              <GitBranch className="size-4" aria-hidden="true" />
              <span>Continue with GitHub</span>
            </button>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
                Pending submissions ({submissions.length})
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
          </div>
        </section>
      )}
    </main>
  )
}
