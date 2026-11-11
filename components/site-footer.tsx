import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-6">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 text-xs text-muted-foreground sm:px-6">
        <span>2026 Rehubber®</span>
        <span className="text-muted-foreground/40" aria-hidden="true">•</span>
        <Link
          href="/partner"
          className="text-muted-foreground transition-colors hover:text-primary hover:underline underline-offset-4"
        >
          Partner with us
        </Link>
        <span className="text-muted-foreground/40" aria-hidden="true">•</span>
        <Link
          href="/admin"
          className="text-muted-foreground transition-colors hover:text-primary hover:underline underline-offset-4"
        >
          Admin
        </Link>
      </div>
    </footer>
  )
}
