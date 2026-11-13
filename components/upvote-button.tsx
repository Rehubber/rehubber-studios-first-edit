'use client'

import { useEffect, useState } from 'react'
import { ArrowBigUp } from 'lucide-react'
import posthog from 'posthog-js'

const VOTE_STORAGE_KEY = 'rehubber:reddit-vote-state:v1'

function invalidateDirectoryPageCache() {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith('rehubber:directory-page:')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Ignore storage errors
  }
}

export function UpvoteButton({
  slug,
  initialCount = 0,
}: {
  slug: string
  initialCount?: number
}) {
  const [upvoted, setUpvoted] = useState(false)
  const [liveCount, setLiveCount] = useState(initialCount)

  useEffect(() => {
    setLiveCount(initialCount)
  }, [initialCount])

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
    const delta = nextState ? 1 : -1
    setUpvoted(nextState)
    setLiveCount((prev) => Math.max(0, prev + delta))
    posthog.capture('tool_vote_changed', {
      tool_slug: slug,
      vote_state: nextState ? 'upvoted' : 'removed',
    })

    try {
      if (nextState) {
        window.localStorage.setItem(`${VOTE_STORAGE_KEY}:${slug}`, 'up')
      } else {
        window.localStorage.removeItem(`${VOTE_STORAGE_KEY}:${slug}`)
      }
      invalidateDirectoryPageCache()
    } catch {
      // Ignore localStorage write errors
    }

    try {
      const { getFirebaseClientFirestore } = await import('@/lib/firebase-client')
      const { doc, updateDoc, increment } = await import('firebase/firestore')
      const db = getFirebaseClientFirestore()
      const ruleRef = doc(db, 'rules', slug)
      await updateDoc(ruleRef, { upvotes: increment(delta) })
    } catch {
      // Local optimistic vote remains in UI
    }
  }

  const displayCount = Math.max(0, liveCount)

  return (
    <button
      type="button"
      onClick={handleToggleVote}
      aria-label={`${upvoted ? 'Remove upvote' : 'Upvote'}, ${displayCount.toLocaleString()} upvotes`}
      aria-pressed={upvoted}
      className={`group/vote inline-flex h-5 items-center gap-1 rounded-full border px-2 transition-colors cursor-pointer ${
        upvoted
          ? 'border-[#ff4500]/50 bg-[#ff4500]/10 text-[#ff4500]'
          : 'border-border/70 bg-secondary/70 text-foreground hover:border-border hover:bg-secondary/90'
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
        className={`text-[8.5px] font-medium leading-none tabular-nums [text-shadow:none] transition-colors ${
          upvoted ? 'text-[#ff4500]' : 'text-foreground group-hover/vote:text-[#ff4500]'
        }`}
      >
        {displayCount.toLocaleString()}
      </span>
    </button>
  )
}
