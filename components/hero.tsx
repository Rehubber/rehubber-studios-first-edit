import Link from 'next/link'
import { ChevronDown, Handshake, Plus } from 'lucide-react'

export function Hero() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 pt-8 pb-4 text-center sm:px-6">
      <h1 className="max-w-2xl text-balance tracking-tight">
        <span className="block text-2xl font-extrabold leading-tight tracking-tight sm:text-[30px] lg:text-[33px]">
          Discover open source tools <span className="font-mono text-primary">updated daily</span>
          <span aria-hidden="true" className="animate-caret ml-1 inline-block h-[0.9em] w-[0.08em] translate-y-[0.1em] bg-primary" />
        </span>
      </h1>

      <p className="max-w-xl text-pretty text-[14px] leading-relaxed text-muted-foreground sm:text-[15.5px]">
        Ranked by the community, over 600 listed across all categories
      </p>

      <div className="flex flex-col items-center gap-3.5 pt-1">
        <a
          href="#rules"
          className="group relative flex w-48 flex-col items-center justify-center gap-0.5 rounded-lg bg-primary py-1.5 shadow-lg shadow-primary/20 ring-1 ring-white/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-[17px] font-semibold tracking-tight leading-tight text-primary-foreground drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]">
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
            href="/support"
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
