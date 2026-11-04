import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Open source. Published rules are served as static JSON from the CDN.
        </p>
        <p>
          Missing your stack?{' '}
          <Link href="/submit" className="text-primary underline-offset-4 hover:underline">
            Submit for review
          </Link>
        </p>
      </div>
    </footer>
  )
}
