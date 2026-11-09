import type { Metadata } from 'next'
import { Bell, ExternalLink } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SubmitForm } from '@/components/submit-form'

export const metadata: Metadata = {
  title: 'Submit your open source tool · Rehubber',
  description: 'Submit your open-source developer tool to Rehubber for community review and listing.',
  openGraph: {
    title: 'Submit your open source tool · Rehubber',
    description: 'Submit your open-source developer tool to Rehubber for community review and listing.',
    url: 'https://www.rehubber.com/submit',
    siteName: 'Rehubber',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Submit your open source tool · Rehubber',
    description: 'Submit your open-source developer tool to Rehubber for community review and listing.',
  },
}

export default function SubmitPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_20rem] lg:gap-16">
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Submit your open source tool
            </h1>
          </header>
          <SubmitForm />
        </div>

        <aside className="lg:pt-20">
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
            <ul className="flex flex-col gap-5">
              <li className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
                  <Bell className="size-4" aria-hidden="true" />
                </span>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  We&apos;ll notify you when your tool is published if you provide your email after submitting
                </p>
              </li>

              <li className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
                  <ExternalLink className="size-4" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <a
                    href="https://x.com/oddysseusnt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <span>Follow us on X</span>
                    <span className="text-muted-foreground">(@oddysseusnt)</span>
                  </a>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Get updates, releases, and announcements
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </aside>
      </main>
    </>
  )
}
