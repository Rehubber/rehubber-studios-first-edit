import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { PartnerForm } from '@/components/partner-form'

export const metadata: Metadata = {
  title: 'Open-Source Sponsorship Opportunities',
  description:
    'Learn about Rehubber sponsorship and the reserved site-ally placement for open-source developer tools.',
  alternates: { canonical: '/partner/' },
  robots: { index: false },
  openGraph: {
    title: 'Partner with Rehubber',
    description:
      'Learn about Rehubber sponsorship and the reserved site-ally placement for open-source developer tools.',
    url: 'https://www.rehubber.com/partner/',
    siteName: 'Rehubber',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Partner with Rehubber',
    description:
      'Learn about Rehubber sponsorship and the reserved site-ally placement for open-source developer tools.',
  },
}

export default function PartnerPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
        <header className="flex flex-col gap-2">
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
            Let&rsquo;s partner
          </h1>
          <p className="max-w-2xl text-pretty text-sm text-muted-foreground leading-relaxed">
            To help sustain and grow this site, we&apos;re offering a single reserved spot as Rehubber Open source site Ally
          </p>
        </header>

        <PartnerForm />
      </main>
    </>
  )
}
