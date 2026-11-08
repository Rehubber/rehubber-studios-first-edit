import type { Metadata } from 'next'
import { Handshake, Target, Users, Zap } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { PartnerForm } from '@/components/partner-form'

export const metadata: Metadata = {
  title: 'Partner with Rehubber · Open Source Collaborations & Sponsorships',
  description:
    'Partner with Rehubber to showcase developer tools, sponsor directory placements, and reach thousands of open-source engineers.',
  openGraph: {
    title: 'Partner with Rehubber · Open Source Collaborations & Sponsorships',
    description:
      'Partner with Rehubber to showcase developer tools, sponsor directory placements, and reach thousands of open-source engineers.',
    url: 'https://www.rehubber.com/partner',
    siteName: 'Rehubber',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Partner with Rehubber · Open Source Collaborations & Sponsorships',
    description:
      'Partner with Rehubber to showcase developer tools, sponsor directory placements, and reach thousands of open-source engineers.',
  },
}

const benefits = [
  {
    icon: Target,
    title: 'High-Intent Developer Audience',
    body: 'Rehubber connects directly with software engineers, open-source creators, and tech leads actively looking for development tools.',
  },
  {
    icon: Zap,
    title: 'Curated Quality & Zero Spam',
    body: 'Every partner tool and sponsor undergoes moderation to ensure high developer utility and authenticity.',
  },
  {
    icon: Users,
    title: 'Multi-Channel Placement',
    body: 'Reach developers through directory placements, category spotlights, and developer newsletter inclusions.',
  },
]

export default function PartnerPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_20rem] lg:gap-16">
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <Handshake className="size-4" aria-hidden="true" />
              <span>Collaborations & Sponsorships</span>
            </div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
              Partner with Rehubber
            </h1>
            <p className="max-w-xl text-pretty text-sm text-muted-foreground leading-relaxed">
              Looking to promote a developer tool, sponsor open-source categories, or integrate with our directory? 
              Share your details below and our team will get in touch.
            </p>
          </header>

          <PartnerForm />
        </div>

        <aside aria-labelledby="partner-benefits" className="lg:pt-20">
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
            <h2 id="partner-benefits" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Why partner with us
            </h2>
            <ul className="flex flex-col gap-5">
              {benefits.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </>
  )
}
