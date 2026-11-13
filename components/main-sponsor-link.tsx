'use client'

import { useEffect, useState } from 'react'
import { ACTIVE_SPONSOR_SLOT_ID } from '@/lib/sponsor-weeks'
import type { SponsorBooking } from '@/lib/types'
import posthog from 'posthog-js'

export const MAIN_SPONSOR_CACHE_KEY = 'rehubber:main-sponsor:v2'
const MAIN_SPONSOR_CACHE_TTL_MS = 2 * 60 * 1000

export function invalidateMainSponsorCache() {
  try {
    window.localStorage.removeItem(MAIN_SPONSOR_CACHE_KEY)
  } catch {
    // Ignore storage errors
  }
}

export function MainSponsorLink() {
  const [booking, setBooking] = useState<SponsorBooking | null>(null)

  useEffect(() => {
    let cancelled = false
    const now = Date.now()

    try {
      const raw = window.localStorage.getItem(MAIN_SPONSOR_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as {
          savedAt?: number
          booking?: SponsorBooking | null
        }
        if (typeof parsed.savedAt === 'number' && now - parsed.savedAt < MAIN_SPONSOR_CACHE_TTL_MS) {
          const cachedBooking = parsed.booking ?? null
          if (cachedBooking && cachedBooking.status === 'active' && cachedBooking.endsAtMs > now) {
            setBooking(cachedBooking)
          } else {
            setBooking(null)
          }
          return
        }
      }
    } catch {
      // Ignore storage read errors
    }

    const fetchCurrentSponsor = async () => {
      try {
        const { getFirebaseClientFirestore, isFirebaseConfigured } = await import('@/lib/firebase-client')
        if (!isFirebaseConfigured()) return
        const { doc, getDoc } = await import('firebase/firestore')
        const db = getFirebaseClientFirestore()
        const snap = await getDoc(doc(db, 'sponsor_bookings', ACTIVE_SPONSOR_SLOT_ID))

        let nextBooking: SponsorBooking | null = null
        if (snap.exists()) {
          const data = snap.data()
          const endsAtMs = typeof data.endsAtMs === 'number' ? data.endsAtMs : 0
          if (
            data.status === 'active' &&
            endsAtMs > Date.now() &&
            typeof data.sponsorName === 'string' &&
            typeof data.sponsorUrl === 'string'
          ) {
            nextBooking = {
              weekId: snap.id,
              weekStart: String(data.weekStart || ''),
              weekEnd: String(data.weekEnd || ''),
              startsAtMs: typeof data.startsAtMs === 'number' ? data.startsAtMs : 0,
              endsAtMs,
              sponsorName: data.sponsorName,
              sponsorUrl: data.sponsorUrl,
              amountUsd: typeof data.amountUsd === 'number' ? data.amountUsd : 299,
              status: 'active',
            }
          }
        }

        if (cancelled) return
        setBooking(nextBooking)
        try {
          window.localStorage.setItem(
            MAIN_SPONSOR_CACHE_KEY,
            JSON.stringify({ savedAt: Date.now(), booking: nextBooking }),
          )
        } catch {
          // Ignore storage write errors
        }
      } catch {
        // Non-blocking
      }
    }

    void fetchCurrentSponsor()
    return () => {
      cancelled = true
    }
  }, [])

  if (!booking) return null

  return (
    <>
      {' · '}
      <span>
        Brought to you by{' '}
        <a
          href={booking.sponsorUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() =>
            posthog.capture('main_sponsor_clicked', {
              sponsor_name: booking.sponsorName,
              week_id: booking.weekId,
            })
          }
          className="font-semibold text-foreground underline decoration-primary/70 decoration-1 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
        >
          {booking.sponsorName}
        </a>
      </span>
    </>
  )
}
