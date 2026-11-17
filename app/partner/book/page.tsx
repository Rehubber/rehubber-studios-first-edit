import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { PartnerCheckoutForm } from '@/components/partner-checkout-form'

export const metadata: Metadata = {
  title: 'Reserve a Sponsorship Placement',
  description:
    'Enter sponsor details to reserve Rehubber’s weekly site-ally placement for open-source developer tools.',
  alternates: { canonical: '/partner/book/' },
  robots: { index: false },
  openGraph: {
    title: 'Reserve a Sponsorship Placement | Rehubber',
    description: 'Enter sponsor details to reserve Rehubber’s weekly site-ally placement for open-source developer tools.',
    url: 'https://www.rehubber.com/partner/book/',
    siteName: 'Rehubber',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Reserve a Sponsorship Placement | Rehubber',
    description: 'Enter sponsor details to reserve Rehubber’s weekly site-ally placement for open-source developer tools.',
  },
}

export default function PartnerBookPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
        <header className="flex flex-col gap-2">
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
            Sponsor Information
          </h1>
          <p className="max-w-2xl text-pretty text-sm text-muted-foreground leading-relaxed">
            Reserve the single Rehubber Open source site Ally placement for 1 week ($299 USD).
          </p>
        </header>

        <PartnerCheckoutForm />
      </main>
    </>
  )
}
