'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  Lock,
} from 'lucide-react'
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import {
  getFirebaseClientFirestore,
  handleFirestoreError,
  isFirebaseConfigured,
  OperationType,
} from '@/lib/firebase-client'
import { invalidateMainSponsorCache } from '@/components/main-sponsor-link'
import { ACTIVE_SPONSOR_SLOT_ID, buildLiveSponsorWindow, formatRealDateTime } from '@/lib/sponsor-weeks'
import type { SponsorBooking } from '@/lib/types'
import posthog from 'posthog-js'

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
  const [confirmedBooking, setConfirmedBooking] = useState<SponsorBooking | null>(null)
  const [confirmedEmail, setConfirmedEmail] = useState('')

  useEffect(() => {
    setNowMs(Date.now())
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

  const liveWindow = buildLiveSponsorWindow(nowMs)
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

    const checkoutWindow = buildLiveSponsorWindow(Date.now())
    const contactDocId = `booking_${checkoutWindow.startsAtMs}`

    try {
      const db = getFirebaseClientFirestore()
      const bookingRef = doc(db, 'sponsor_bookings', ACTIVE_SPONSOR_SLOT_ID)
      const contactRef = doc(db, 'sponsor_contacts', contactDocId)

      await runTransaction(db, async (transaction) => {
        const existingSnap = await transaction.get(bookingRef)
        if (existingSnap.exists()) {
          const existingData = existingSnap.data()
          const existingEndMs = typeof existingData.endsAtMs === 'number' ? existingData.endsAtMs : 0
          if (existingData.status === 'active' && existingEndMs > Date.now()) {
            throw new Error('SLOT_ALREADY_BOOKED')
          }
        }

        transaction.set(bookingRef, {
          weekId: ACTIVE_SPONSOR_SLOT_ID,
          weekStart: checkoutWindow.weekStartIso,
          weekEnd: checkoutWindow.weekEndIso,
          startsAtMs: checkoutWindow.startsAtMs,
          endsAtMs: checkoutWindow.endsAtMs,
          sponsorName: trimmedName,
          sponsorUrl: trimmedUrl,
          amountUsd: WEEKLY_PRICE_USD,
          status: 'active',
          createdAt: serverTimestamp(),
        })

        transaction.set(contactRef, {
          bookingId: contactDocId,
          weekId: ACTIVE_SPONSOR_SLOT_ID,
          weekStart: checkoutWindow.weekStartIso,
          weekEnd: checkoutWindow.weekEndIso,
          email: trimmedEmail,
          sponsorName: trimmedName,
          createdAt: serverTimestamp(),
        })
      })

      invalidateMainSponsorCache()

      const bookedRecord: SponsorBooking = {
        weekId: ACTIVE_SPONSOR_SLOT_ID,
        weekStart: checkoutWindow.weekStartIso,
        weekEnd: checkoutWindow.weekEndIso,
        startsAtMs: checkoutWindow.startsAtMs,
        endsAtMs: checkoutWindow.endsAtMs,
        sponsorName: trimmedName,
        sponsorUrl: trimmedUrl,
        amountUsd: WEEKLY_PRICE_USD,
        status: 'active',
      }

      setActiveBooking(bookedRecord)
      setConfirmedBooking(bookedRecord)
      setConfirmedEmail(trimmedEmail)

      posthog.capture('main_sponsor_slot_booked', {
        week_id: ACTIVE_SPONSOR_SLOT_ID,
        amount_usd: WEEKLY_PRICE_USD,
        sponsor_name: trimmedName,
      })

      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      if (err instanceof Error && err.message === 'SLOT_ALREADY_BOOKED') {
        setError('This single reserved spot was just booked. Please check back once the current 1-week run finishes.')
      } else if (err instanceof Error && (err.message.includes('permission') || err.message.includes('insufficient'))) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `sponsor_bookings/${ACTIVE_SPONSOR_SLOT_ID}`)
        } catch {
          setError('Unable to complete booking right now. Please verify your inputs and try again.')
        }
      } else {
        setError(err instanceof Error ? err.message : 'Unable to lock this spot right now. Please try again.')
      }
    } finally {
      setPending(false)
    }
  }

  if (confirmedBooking) {
    return (
      <div className="flex flex-col gap-6 rounded-xl border border-primary/40 bg-primary/5 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Check className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Your Spot Is Confirmed
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Your 1-week reservation for{' '}
              <span className="font-semibold text-foreground">{confirmedBooking.sponsorName}</span> is live from{' '}
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatRealDateTime(confirmedBooking.startsAtMs)}
              </span>{' '}
              to{' '}
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatRealDateTime(confirmedBooking.endsAtMs)}
              </span>
              .
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 text-xs">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Duration</span>
              <span className="font-medium text-foreground">1 week reserved spot</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
              <span className="font-mono font-semibold tabular-nums text-foreground">$299 USD · 1 week</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Receipt Sent To</span>
              <span className="font-mono text-foreground truncate">{confirmedEmail}</span>
            </div>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          1-week-at-a-time: Once this 1-week window finishes ({formatRealDateTime(confirmedBooking.endsAtMs)}), you can
          return and book again.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 whitespace-nowrap"
          >
            <span>View Homepage Placement</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
          <a
            href={confirmedBooking.sponsorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary whitespace-nowrap"
          >
            <span>Test Destination Link</span>
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>
      </div>
    )
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
              <span suppressHydrationWarning>{liveWindow.rangeFormatted}</span>
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
                <span>Booking spot…</span>
              </>
            ) : (
              <>
                <span>Book a spot</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
