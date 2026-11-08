import type { Metadata } from 'next'
import { LifeBuoy, Clock, ShieldCheck, Mail } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SupportForm } from '@/components/support-form'

export const metadata: Metadata = {
  title: 'Support & Inquiries · Rehubber',
  description:
    'Need help with your tool listing, have a feature request, or spotted a bug? Contact the Rehubber developer directory team.',
  openGraph: {
    title: 'Support & Inquiries · Rehubber',
    description:
      'Contact Rehubber support for tool claims, bug reports, feature requests, or partnerships.',
    url: 'https://www.rehubber.com/support',
    siteName: 'Rehubber',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Support & Inquiries · Rehubber',
    description:
      'Contact Rehubber support for tool claims, bug reports, feature requests, or partnerships.',
  },
}

const highlights = [
  {
    icon: Clock,
    title: 'Fast Response Times',
    body: 'We typically review incoming inquiries and bug reports within 24–48 hours.',
  },
  {
    icon: ShieldCheck,
    title: 'Tool Ownership & Claims',
    body: 'If you are the creator of an open-source tool listed here, contact us to claim ownership or update metadata.',
  },
  {
    icon: Mail,
    title: 'Direct Email',
    body: 'Prefer email? You can always reach us directly at support@rehubber.com.',
  },
]

export default function SupportPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_20rem] lg:gap-16">
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <LifeBuoy className="size-4" aria-hidden="true" />
              <span>Help & Developer Support</span>
            </div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
              Contact & Support
            </h1>
            <p className="max-w-xl text-pretty text-sm text-muted-foreground leading-relaxed">
              Have a question about a tool, want to report an issue, or claim an existing project? 
              Fill out the form below and we will get back to you directly.
            </p>
          </header>

          <SupportForm />
        </div>

        <aside aria-labelledby="support-info" className="lg:pt-20">
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
            <h2 id="support-info" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              What to expect
            </h2>
            <ul className="flex flex-col gap-5">
              {highlights.map(({ icon: Icon, title, body }) => (
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
