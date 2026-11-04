'use client'

import { useState } from 'react'
import { LoaderCircle, ThumbsUp } from 'lucide-react'

const VOTED_SLUGS_KEY = 'rehubber:voted-slugs:v1:'

function getVotedSlugs(uid: string): string[] {
  try {
    const stored = window.localStorage.getItem(`${VOTED_SLUGS_KEY}${uid}`)
    const parsed: unknown = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed.filter((slug): slug is string => typeof slug === 'string') : []
  } catch {
    return []
  }
}

export function UpvoteButton({ slug, initialCount }: { slug: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  const [voted, setVoted] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function vote() {
    if (pending || voted) return

    setPending(true)
    setError(null)
    const previousCount = count
    setCount((current) => current + 1)

    try {
      const [authSdk, firestoreSdk, firebaseClient] = await Promise.all([
        import('firebase/auth'),
        import('firebase/firestore'),
        import('@/lib/firebase-client'),
      ])
      const { GithubAuthProvider, signInWithPopup } = authSdk
      const { increment, serverTimestamp, writeBatch, doc } = firestoreSdk
      const { getFirebaseAppCheckToken, getFirebaseClientAuth, getFirebaseClientFirestore } = firebaseClient
      const auth = getFirebaseClientAuth()
      const user = auth.currentUser ?? (await signInWithPopup(auth, new GithubAuthProvider())).user
      if (getVotedSlugs(user.uid).includes(slug)) {
        setVoted(true)
        setCount(previousCount)
        return
      }

      await getFirebaseAppCheckToken()
      const db = getFirebaseClientFirestore()
      const voteRef = doc(db, 'votes', `${slug}__${user.uid}`)
      const ruleRef = doc(db, 'rules', slug)
      const batch = writeBatch(db)
      batch.set(voteRef, { slug, uid: user.uid, createdAt: serverTimestamp() })
      batch.update(ruleRef, { upvotes: increment(1) })
      await batch.commit()

      const votedSlugs = new Set(getVotedSlugs(user.uid))
      votedSlugs.add(slug)
      try {
        window.localStorage.setItem(`${VOTED_SLUGS_KEY}${user.uid}`, JSON.stringify([...votedSlugs]))
      } catch {
        // Firestore enforces one vote per account even without this local hint.
      }
      setVoted(true)
    } catch (voteError) {
      setCount(previousCount)
      setError(
        voteError instanceof Error && voteError.message.includes('permission')
          ? 'This GitHub account may have already voted for this rule.'
          : voteError instanceof Error
            ? voteError.message
            : 'Could not record your vote. Please try again.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={vote}
        disabled={voted || pending}
        aria-label={`${voted ? 'You upvoted' : 'Upvote'} ${slug}, ${count} upvotes`}
        aria-pressed={voted}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-default disabled:opacity-80"
      >
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <ThumbsUp className="size-3.5" aria-hidden="true" />
        )}
        <span>{count}</span>
      </button>
      {error && (
        <span role="status" className="max-w-48 text-right text-[10px] text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}
