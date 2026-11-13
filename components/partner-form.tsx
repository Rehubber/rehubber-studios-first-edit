'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CalendarClock, Info } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { getFirebaseClientFirestore, isFirebaseConfigured } from '@/lib/firebase-client'
import { ACTIVE_SPONSOR_SLOT_ID, buildLiveSponsorWindow, formatRealDateTime } from '@/lib/sponsor-weeks'
import type { SponsorBooking } from '@/lib/types'

export function PartnerForm() {
  const [nowMs, setNowMs] = useState<number>(() => Date.now())
  const [activeBooking, setActiveBooking] = useState<SponsorBooking | null>(null)

  useEffect(() => {
    setNowMs(Date.now())
    const timer = setInterval(() => setNowMs(Date.now()), 30_000)

    let cancelled = false
    const checkCurrentBooking = async () => {
      if (!isFirebaseConfigured()) return
      try {
        const db = getFirebaseClientFirestore()
        const snap = await getDoc(doc(db, 'sponsor_bookings', ACTIVE_SPONSOR_SLOT_ID))
        if (!snap.exists() || cancelled) return
        const data = snap.data()
        const endsAtMs = typeof data.endsAtMs === 'number' ? data.endsAtMs : 0
        if (data.status === 'active' && endsAtMs > Date.now()) {
          setActiveBooking({
            weekId: snap.id,
            weekStart: String(data.weekStart || ''),
            weekEnd: String(data.weekEnd || ''),
            startsAtMs: typeof data.startsAtMs === 'number' ? data.startsAtMs : 0,
            endsAtMs,
            sponsorName: String(data.sponsorName || ''),
            sponsorUrl: String(data.sponsorUrl || ''),
            amountUsd: typeof data.amountUsd === 'number' ? data.amountUsd : 299,
            status: 'active',
          })
        }
      } catch {
        // Ignore non-blocking availability read errors
      }
    }

    void checkCurrentBooking()
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const liveWindow = buildLiveSponsorWindow(nowMs)
  const previewBrand = activeBooking ? activeBooking.sponsorName : 'Your site'

  return (
    <div className="flex flex-col gap-6">
      {/* Your appearance on homepage preview */}
      <section aria-labelledby="sponsor-preview-heading" className="flex flex-col gap-2.5">
        <h2 id="sponsor-preview-heading" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Your appearance on homepage preview
        </h2>

        <div className="rounded-xl border border-border bg-card px-5 py-6 text-center shadow-xs">
          <p className="text-base font-extrabold tracking-tight text-foreground sm:text-xl">
            Discover open source tools updated daily
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Ranked by the community, over 600 listed across all categories
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">
            Get yours listed · Brought to you by{' '}
            <span className="font-semibold text-foreground underline decoration-primary/80 decoration-1 underline-offset-4">
              {previewBrand}
            </span>
            <span className="ml-1.5 inline-flex items-center align-middle text-primary" aria-hidden="true">
              <ArrowLeft className="size-4 stroke-[2.5]" />
            </span>
          </p>
        </div>
      </section>

      {/* Box below link preview */}
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
        <Info className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="leading-relaxed text-foreground">1-week-at-a-time: Book for 1 week at a time</p>
      </div>

      {/* Very bottom box: real current-day-to-1-week-later dates & times + Book a spot */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex items-center gap-2 font-mono text-xs tabular-nums text-foreground">
          <CalendarClock className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span suppressHydrationWarning>
            {activeBooking
              ? `Reserved until ${formatRealDateTime(activeBooking.endsAtMs)}`
              : liveWindow.rangeFormatted}
          </span>
        </div>

        <Link
          href="/partner/book/"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap shrink-0"
        >
          <span>Book a spot</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
