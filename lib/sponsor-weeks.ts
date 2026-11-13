export const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
export const ACTIVE_SPONSOR_SLOT_ID = 'current'

export type LiveSponsorWindow = {
  startsAtMs: number
  endsAtMs: number
  weekStartIso: string
  weekEndIso: string
  startFormatted: string
  endFormatted: string
  rangeFormatted: string
}

export function formatRealDateTime(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}

export function buildLiveSponsorWindow(referenceMs: number = Date.now()): LiveSponsorWindow {
  const startsAtMs = referenceMs
  const endsAtMs = referenceMs + ONE_WEEK_MS
  const startFormatted = formatRealDateTime(startsAtMs)
  const endFormatted = formatRealDateTime(endsAtMs)

  return {
    startsAtMs,
    endsAtMs,
    weekStartIso: new Date(startsAtMs).toISOString(),
    weekEndIso: new Date(endsAtMs).toISOString(),
    startFormatted,
    endFormatted,
    rangeFormatted: `${startFormatted} – ${endFormatted}`,
  }
}

const SHORT_DATE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatToolAddedDate(value: unknown): string | undefined {
  if (!value) return undefined

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(trimmed)) {
      return trimmed
    }
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getUTCDate()} ${SHORT_DATE_MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`
    }
    return trimmed
  }

  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number }
    if (typeof maybeTimestamp.toDate === 'function') {
      const d = maybeTimestamp.toDate()
      if (!Number.isNaN(d.getTime())) {
        return `${d.getUTCDate()} ${SHORT_DATE_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
      }
    } else if (typeof maybeTimestamp.seconds === 'number') {
      const d = new Date(maybeTimestamp.seconds * 1000)
      if (!Number.isNaN(d.getTime())) {
        return `${d.getUTCDate()} ${SHORT_DATE_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
      }
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) {
      return `${d.getUTCDate()} ${SHORT_DATE_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    }
  }

  return undefined
}
