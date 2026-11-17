export const googleAnalyticsId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? ''
export const hasGoogleAnalyticsId = /^G-[A-Z0-9]+$/i.test(googleAnalyticsId)

type AnalyticsParameter = string | number | boolean | undefined
type AnalyticsParameters = Record<string, AnalyticsParameter>

export type ListingAnalyticsContext = {
  listingId: string
  listingName: string
  listingPosition: number
  source: string
}

export function getOutboundEventParameters(url: string): AnalyticsParameters {
  try {
    const destination = new URL(url)
    const domain = destination.hostname.replace(/^www\./, '')
    const repositoryDomains = ['github.com', 'gitlab.com', 'codeberg.org', 'bitbucket.org']

    return {
      destination_domain: domain,
      destination_type: repositoryDomains.includes(domain) ? 'repository' : 'website',
    }
  } catch {
    return {
      destination_domain: 'unknown',
      destination_type: 'unknown',
    }
  }
}

declare global {
  interface Window {
    dataLayer?: unknown[][]
    gtag?: (...args: unknown[]) => void
  }
}

export function trackAnalyticsEvent(eventName: string, parameters: AnalyticsParameters = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return

  const cleanParameters = Object.fromEntries(
    Object.entries(parameters).filter(([, value]) => value !== undefined),
  )
  window.gtag('event', eventName, cleanParameters)
}

export function trackListingEvent(
  eventName: string,
  context: ListingAnalyticsContext,
  parameters: AnalyticsParameters = {},
) {
  trackAnalyticsEvent(eventName, {
    listing_id: context.listingId,
    listing_name: context.listingName.slice(0, 100),
    listing_position: context.listingPosition,
    source: context.source,
    ...parameters,
  })
}
