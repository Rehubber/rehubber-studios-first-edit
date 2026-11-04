'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import type { SubmitResponse } from '@/lib/types'

type Success = Extract<SubmitResponse, { ok: true }>

export function SubmitSuccess({ result, onReset }: { result: Success; onReset: () => void }) {
  return (
    <section aria-live="polite" className="flex flex-col gap-6 rounded-xl border border-primary/30 bg-card p-6">
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <CheckCircle2 className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Submission received</h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Thank you for contributing. A moderator will review it before it appears in the directory.
          </p>
        </div>
      </div>

      <dl className="grid gap-2 rounded-lg border border-border bg-code p-4 font-mono text-xs sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">status</dt>
        <dd className="text-primary">pending review</dd>
        <dt className="text-muted-foreground">submission</dt>
        <dd className="break-all">{result.submissionId}</dd>
      </dl>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onReset}
          className="h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-secondary"
        >
          Submit another
        </button>
        <Link href="/" className="flex h-10 items-center rounded-md px-4 text-sm text-muted-foreground hover:text-foreground">
          Back to directory
        </Link>
      </div>
    </section>
  )
}
