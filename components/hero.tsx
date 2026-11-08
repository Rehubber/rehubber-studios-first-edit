import Link from 'next/link'
import { ChevronDown, Handshake, Plus } from 'lucide-react'

export function Hero() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-2.5 px-4 pt-5 pb-2 text-center sm:px-6">
      <h1 className="tracking-tight text-foreground">
        <span className="block text-xl font-extrabold tracking-tight sm:text-[28px] lg:text-[32px] sm:whitespace-nowrap">
          Discover open source tools updated daily
          <span aria-hidden="true" className="animate-caret ml-1.5 inline-block h-[0.85em] w-[0.08em] translate-y-[0.08em] bg-foreground/80" />
        </span>
      </h1>

      <div className="flex flex-col items-center gap-1">
        <p className="max-w-xl text-pretty text-[14px] leading-relaxed text-muted-foreground sm:text-[15.5px]">
          Ranked by the community, over 600 listed across all categories
        </p>
        <Link
          href="/submit"
          className="text-[13px] font-medium text-primary underline-offset-4 hover:underline sm:text-[14px]"
        >
          Get yours listed
        </Link>
      </div>

      <div className="flex flex-col items-center gap-3.5 pt-1">
        <a
          href="#rules"
          className="group relative flex w-48 flex-col items-center justify-center gap-0.5 rounded-lg bg-primary py-1.5 transition-colors hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-[17px] font-semibold tracking-tight leading-tight text-primary-foreground">
            Start Exploring
          </span>
          <span className="flex flex-col items-center -space-y-2 text-primary-foreground/85 transition-transform duration-200 group-hover:translate-y-0.5" aria-hidden="true">
            <ChevronDown className="size-3.5 stroke-[2.5]" />
            <ChevronDown className="size-3.5 stroke-[2.5]" />
          </span>
        </a>

        {/* The 2 buttons below Start Exploring */}
        <div className="flex items-center gap-2.5 pt-0.5">
          <Link
            href="/submit"
            className="inline-flex h-9 min-w-32 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:border-primary/60 hover:bg-secondary hover:text-primary"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>Submit</span>
          </Link>
          <Link
            href="/partner"
            className="inline-flex h-9 min-w-32 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:border-primary/60 hover:bg-secondary hover:text-primary"
          >
            <Handshake className="size-3.5" aria-hidden="true" />
            <span>Let&apos;s partner</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
