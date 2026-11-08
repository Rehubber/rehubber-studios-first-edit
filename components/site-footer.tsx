import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Open source. Published rules are served as static JSON from the CDN.
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Missing your stack?</span>
          <Link href="/submit" className="text-primary underline-offset-4 hover:underline">
            Submit for review
          </Link>
          <span className="text-muted-foreground/30" aria-hidden="true">•</span>
          <Link href="/support" className="text-foreground/80 underline-offset-4 hover:text-primary hover:underline">
            Support
          </Link>
        </div>
      </div>
    </footer>
  )
}
