import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="font-mono text-base font-bold tracking-tight text-foreground transition-colors hover:text-primary"
        >
          Rehubber
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/"
            className="rounded-md border border-border/80 bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-secondary hover:text-primary"
          >
            Admin
          </Link>
          <Link
            href="/support/"
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Support
          </Link>
        </div>
      </div>
    </header>
  )
}
