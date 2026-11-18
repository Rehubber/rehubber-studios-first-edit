'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CircleAlert,
  LoaderCircle,
  Lock,
} from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import {
  getFirebaseClientFirestore,
  isFirebaseConfigured,
} from '@/lib/firebase-client'
import { ACTIVE_SPONSOR_SLOT_ID, formatRealDateTime } from '@/lib/sponsor-weeks'
import type { SponsorBooking } from '@/lib/types'

const WEEKLY_PRICE_USD = 299

const inputClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

function isValidHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function PartnerCheckoutForm() {
  const [nowMs, setNowMs] = useState<number>(() => Date.now())
  const [activeBooking, setActiveBooking] = useState<SponsorBooking | null>(null)
  const [checkingAvailability, setCheckingAvailability] = useState(true)

  const [sponsorName, setSponsorName] = useState('')
  const [sponsorUrl, setSponsorUrl] = useState('')
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkoutResult, setCheckoutResult] = useState<string | null>(null)

  useEffect(() => {
    setNowMs(Date.now())
    const result = new URLSearchParams(window.location.search).get('checkout')
    if (result === 'success') {
      setCheckoutResult('Thank you. Stripe is confirming your payment; your placement will go live after confirmation. Contact us if it does not appear shortly.')
    } else if (result === 'cancelled') {
      setCheckoutResult('Checkout was not completed. The temporary reservation remains until the Stripe checkout session expires.')
    }
    const timer = setInterval(() => setNowMs(Date.now()), 30_000)

    let cancelled = false
    const checkCurrentBooking = async () => {
      if (!isFirebaseConfigured()) {
        if (!cancelled) setCheckingAvailability(false)
        return
      }

      try {
        const db = getFirebaseClientFirestore()
        const snap = await getDoc(doc(db, 'sponsor_bookings', ACTIVE_SPONSOR_SLOT_ID))
        if (!cancelled && snap.exists()) {
          const data = snap.data()
          const endsAtMs = typeof data.endsAtMs === 'number' ? data.endsAtMs : 0
          if (data.status === 'active' && endsAtMs > Date.now()) {
            setActiveBooking({
              weekId: snap.id,
              weekStart: String(data.weekStart || ''),
              weekEnd: String(data.weekEnd || ''),
              startsAtMs: typeof data.startsAtMs === 'number' ? data.startsAtMs : 0,
              endsAtMs,
              sponsorName: String(data.sponsorName || 'Reserved'),
              sponsorUrl: String(data.sponsorUrl || ''),
              amountUsd: typeof data.amountUsd === 'number' ? data.amountUsd : WEEKLY_PRICE_USD,
              status: 'active',
            })
          }
        }
      } catch {
        // Non-blocking fallback
      } finally {
        if (!cancelled) setCheckingAvailability(false)
      }
    }

    void checkCurrentBooking()
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const previewBrand = sponsorName.trim() || 'Your site'
  const previewUrl = isValidHttpsUrl(sponsorUrl.trim()) ? sponsorUrl.trim() : '#preview'
  const spotTaken = Boolean(activeBooking && activeBooking.endsAtMs > nowMs)

  async function handleCheckout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (spotTaken && activeBooking) {
      setError(`The single reserved spot is currently active until ${formatRealDateTime(activeBooking.endsAtMs)}.`)
      return
    }

    const trimmedName = sponsorName.trim()
    const trimmedUrl = sponsorUrl.trim()
    const trimmedEmail = email.trim()

    if (trimmedName.length < 2 || trimmedName.length > 32) {
      setError('Sponsor name must be between 2 and 32 characters.')
      return
    }

    if (!isValidHttpsUrl(trimmedUrl) || trimmedUrl.length > 300) {
      setError('Please enter a valid destination URL starting with https://')
      return
    }

    if (!trimmedEmail.includes('@') || trimmedEmail.length < 5 || trimmedEmail.length > 150) {
      setError('Please enter a valid receipt email address.')
      return
    }

    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/sponsor/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorName: trimmedName, sponsorUrl: trimmedUrl, email: trimmedEmail }),
      })
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object') throw new Error('Invalid checkout response.')
      if (!response.ok) {
        throw new Error('error' in data && typeof data.error === 'string' ? data.error : 'Checkout is unavailable.')
      }
      if (!('url' in data) || typeof data.url !== 'string') throw new Error('Invalid checkout response.')
      const checkoutUrl = new URL(data.url)
      if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
        throw new Error('Invalid checkout URL.')
      }
      window.location.assign(checkoutUrl.href)
    } catch (err) {
      console.error('Sponsor checkout failed', err)
      setError(err instanceof Error ? err.message : 'Unable to start checkout. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/partner/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>Back to Let&rsquo;s partner</span>
        </Link>
      </div>

      {checkoutResult && (
        <div role="status" className="rounded-lg border border-primary/40 bg-primary/5 p-3.5 text-xs leading-relaxed text-foreground">
          {checkoutResult}
        </div>
      )}

      {/* Live Preview updating as sponsor types */}
      <section aria-labelledby="checkout-preview-heading" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="checkout-preview-heading" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Your appearance on homepage preview
          </h2>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">$299 / 1 week</span>
        </div>

        <div className="rounded-xl border border-border bg-card px-5 py-5 text-center shadow-xs">
          <p className="text-base font-extrabold tracking-tight text-foreground sm:text-lg">
            Discover open source tools updated daily
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ranked by the community, over 600 listed across all categories
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            Get yours listed · Brought to you by{' '}
            {previewUrl === '#preview' ? (
              <span className="font-semibold text-foreground underline decoration-primary/80 decoration-1 underline-offset-4">
                {previewBrand}
              </span>
            ) : (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground underline decoration-primary/80 decoration-1 underline-offset-4 hover:text-primary"
              >
                {previewBrand}
              </a>
            )}
            <span className="ml-1.5 inline-flex items-center align-middle text-primary" aria-hidden="true">
              <ArrowLeft className="size-4 stroke-[2.5]" />
            </span>
          </p>
        </div>
      </section>

      {spotTaken && activeBooking && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-foreground"
        >
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden="true" />
          <p className="leading-relaxed">
            The single reserved spot is currently active for{' '}
            <strong>{activeBooking.sponsorName}</strong> until{' '}
            <span className="font-mono tabular-nums">{formatRealDateTime(activeBooking.endsAtMs)}</span>. It will reopen
            automatically right after that time.
          </p>
        </div>
      )}

      <form onSubmit={handleCheckout} className="flex flex-col gap-5">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <h3 className="text-xs font-semibold text-foreground">Sponsor Information</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sponsor-name" className="text-xs font-medium text-foreground">
                Sponsor Name <span className="text-destructive">*</span>
              </label>
              <input
                id="sponsor-name"
                type="text"
                required
                minLength={2}
                maxLength={32}
                disabled={spotTaken}
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
                placeholder="Your site"
                className={inputClass}
              />
              <span className="text-[11px] text-muted-foreground">
                Appears as: Brought to you by {previewBrand}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="sponsor-url" className="text-xs font-medium text-foreground">
                Destination URL <span className="text-destructive">*</span>
              </label>
              <input
                id="sponsor-url"
                type="url"
                required
                maxLength={300}
                disabled={spotTaken}
                value={sponsorUrl}
                onChange={(e) => setSponsorUrl(e.target.value)}
                placeholder="https://yourproduct.com"
                className={inputClass}
              />
              <span className="text-[11px] text-muted-foreground">Must start with https://</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="sponsor-email" className="text-xs font-medium text-foreground">
              Receipt & Confirmation Email <span className="text-destructive">*</span>
            </label>
            <input
              id="sponsor-email"
              type="email"
              required
              maxLength={150}
              disabled={spotTaken}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="founder@yourproduct.com"
              className={inputClass}
            />
          </div>
        </div>

        {/* Final checkout box with price + final "Book a spot" button */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs font-semibold tabular-nums text-primary">
              ${WEEKLY_PRICE_USD} USD / 1 week
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
              <Lock className="size-3 shrink-0" aria-hidden="true" />
              <span>Starts after payment confirmation · 1 week</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || checkingAvailability || spotTaken}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            {pending ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                <span>Opening Stripe checkout…</span>
              </>
            ) : (
              <>
                <span>Pay with Stripe</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
