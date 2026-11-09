'use client'

import { useEffect, useState } from 'react'
import { ArrowBigUp } from 'lucide-react'

const VOTE_STORAGE_KEY = 'rehubber:reddit-vote-state:v1'

export function UpvoteButton({
  slug,
  initialCount = 0,
}: {
  slug: string
  initialCount?: number
}) {
  const [upvoted, setUpvoted] = useState(false)
  const [baseCount] = useState(initialCount)

  const currentCount = upvoted ? baseCount + 1 : baseCount

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`${VOTE_STORAGE_KEY}:${slug}`)
      if (stored === 'up') {
        setUpvoted(true)
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [slug])

  async function handleToggleVote(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const nextState = !upvoted
    setUpvoted(nextState)

    try {
      if (nextState) {
        window.localStorage.setItem(`${VOTE_STORAGE_KEY}:${slug}`, 'up')
      } else {
        window.localStorage.removeItem(`${VOTE_STORAGE_KEY}:${slug}`)
      }
    } catch {
      // Ignore localStorage write errors
    }

    try {
      const { getFirebaseClientFirestore } = await import('@/lib/firebase-client')
      const { doc, updateDoc, increment } = await import('firebase/firestore')
      const db = getFirebaseClientFirestore()
      const ruleRef = doc(db, 'rules', slug)
      await updateDoc(ruleRef, { upvotes: increment(nextState ? 1 : -1) })
    } catch {
      // Local optimistic vote remains in UI
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggleVote}
      aria-label={`${upvoted ? 'Remove upvote' : 'Upvote'}, ${currentCount} upvotes`}
      aria-pressed={upvoted}
      className={`group/vote inline-flex h-5 items-center gap-1 rounded-full border px-2 shadow-xs transition-colors ${
        upvoted
          ? 'border-[#ff4500]/50 bg-[#ff4500]/10 text-[#ff4500]'
          : 'border-border/70 bg-secondary/70 text-foreground/90 hover:border-border hover:bg-secondary/90'
      }`}
    >
      <ArrowBigUp
        className={`size-3 transition-transform ${
          upvoted
            ? 'fill-[#ff4500] stroke-[#ff4500] scale-110'
            : 'stroke-[1.75] text-muted-foreground group-hover/vote:text-[#ff4500]'
        }`}
        aria-hidden="true"
      />
      <span
        className={`font-mono text-[8.5px] font-semibold leading-none transition-colors ${
          upvoted ? 'text-[#ff4500]' : 'text-foreground/90 group-hover/vote:text-[#ff4500]'
        }`}
      >
        {currentCount}
      </span>
    </button>
  )
}
