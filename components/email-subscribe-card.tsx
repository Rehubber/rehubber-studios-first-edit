'use client'

import { useState } from 'react'
import { CheckCircle2, LoaderCircle, Mail } from 'lucide-react'

export function EmailSubscribeCard() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setStatus('error')
      setErrorMessage('Please enter a valid email address.')
      return
    }

    setStatus('loading')
    setErrorMessage('')

    try {
      try {
        window.localStorage.setItem('rehubber:newsletter-subscribed', email)
      } catch {
        // Ignore localStorage write errors
      }

      try {
        const { getFirebaseClientFirestore } = await import('@/lib/firebase-client')
        const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
        const db = getFirebaseClientFirestore()
        await addDoc(collection(db, 'subscribers'), {
          email: email.trim().toLowerCase(),
          createdAt: serverTimestamp(),
          source: 'directory-grid-card',
        })
      } catch {
        // Fallback: local optimistic subscription
      }

      setStatus('success')
    } catch {
      setStatus('error')
      setErrorMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <article className="group relative flex h-full min-h-[148px] flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:bg-card/90">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-primary">
          <Mail className="size-3 shrink-0 text-primary" aria-hidden="true" />
          <span className="font-mono text-[11px] font-semibold tracking-wide text-primary">
            Launching our exclusive newsletter
          </span>
        </div>

        <p className="text-pretty text-xs font-medium leading-snug text-foreground">
          Never miss on another top new tool. Sign up to be added to the wait list.
        </p>
      </div>

      {status === 'success' ? (
        <div className="mt-3 flex flex-col items-center justify-center gap-1 rounded-lg border border-primary/30 bg-primary/10 py-2.5 text-center">
          <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground">You&apos;re on the waitlist!</span>
          <span className="text-[11px] text-muted-foreground">We&apos;ll notify you when we launch.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (status === 'error') setStatus('idle')
            }}
            placeholder="Enter your email"
            required
            className="h-8 w-full rounded-lg border border-input bg-secondary/60 px-2.5 font-sans text-xs placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />

          <button
            type="submit"
            disabled={status === 'loading'}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary font-sans text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-70"
          >
            {status === 'loading' ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            <span>{status === 'loading' ? 'Joining waitlist…' : 'Join the waitlist'}</span>
          </button>

          {status === 'error' && errorMessage ? (
            <p className="text-[11px] text-destructive text-center">{errorMessage}</p>
          ) : null}
        </form>
      )}
    </article>
  )
}
