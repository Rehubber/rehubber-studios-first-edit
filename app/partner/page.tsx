import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { PartnerForm } from '@/components/partner-form'

export const metadata: Metadata = {
  title: 'Let’s partner · Rehubber Open Source Site Ally',
  description:
    "To help sustain and grow this site, we're offering a single reserved spot as Rehubber Open source site Ally.",
  openGraph: {
    title: 'Let’s partner · Rehubber Open Source Site Ally',
    description:
      "To help sustain and grow this site, we're offering a single reserved spot as Rehubber Open source site Ally.",
    url: 'https://www.rehubber.com/partner/',
    siteName: 'Rehubber',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Let’s partner · Rehubber Open Source Site Ally',
    description:
      "To help sustain and grow this site, we're offering a single reserved spot as Rehubber Open source site Ally.",
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
