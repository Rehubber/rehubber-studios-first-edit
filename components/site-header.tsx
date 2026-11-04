import Link from 'next/link'
import { Handshake, Plus } from 'lucide-react'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-center px-4 sm:px-6">
        <nav aria-label="Main" className="flex items-center gap-2">
          <Link
            href="/submit"
            className="flex h-9 w-32 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium text-foreground shadow-sm transition-all hover:border-primary hover:bg-secondary hover:text-primary"
          >
            <Plus className="size-4" aria-hidden="true" />
            Submit
          </Link>
          <a
            href="mailto:firecodesecure@gmail.com?subject=Partnership%20Inquiry"
            className="flex h-9 w-32 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium text-foreground shadow-sm transition-all hover:border-primary hover:bg-secondary hover:text-primary"
          >
            <Handshake className="size-4" aria-hidden="true" />
            Lets partner
          </a>
        </nav>
      </div>
    </header>
  )
}
