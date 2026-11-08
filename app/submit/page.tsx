import type { Metadata } from 'next'
import { GitBranch, GitPullRequest, FileCode } from 'lucide-react'
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

const steps = [
  { icon: GitBranch, title: 'Your submission is queued', body: 'It is saved privately while awaiting review.' },
  { icon: FileCode, title: 'A moderator reviews it', body: 'Submissions are checked before publication.' },
  { icon: GitPullRequest, title: 'Approved tools go live', body: 'Approved tools are added to the directory.' },
]

export default function SubmitPage() {
  return (
    <>
    <SiteHeader />
    <main className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_18rem] lg:gap-16">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Submit your open source tool
          </h1>
        </header>
        <SubmitForm />
      </div>

      <aside aria-labelledby="how-it-works" className="lg:pt-24">
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
          <h2 id="how-it-works" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            How it works
          </h2>
          <ol className="flex flex-col gap-5">
            {steps.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </main>
    </>
  )
}
