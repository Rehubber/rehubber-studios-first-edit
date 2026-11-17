import { googleAnalyticsId, hasGoogleAnalyticsId } from '@/lib/analytics'

if (typeof window !== 'undefined' && hasGoogleAnalyticsId) {
  window.dataLayer = window.dataLayer || []
  window.gtag = function (...args: unknown[]) {
    window.dataLayer?.push(args)
  }
  window.gtag('js', new Date())
  window.gtag('config', googleAnalyticsId)
}
