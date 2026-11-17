'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Eye, History } from 'lucide-react'
import { ShareMenu } from '@/components/share-menu'
import { UpvoteButton } from '@/components/upvote-button'
import { formatToolAddedDate } from '@/lib/sponsor-weeks'
import type { Rule } from '@/lib/types'
import { getOutboundEventParameters, trackListingEvent } from '@/lib/analytics'

export function ToolDetailCard({
  rule,
  isModal = false,
  onClose,
  onVoteChange,
}: {
  rule: Rule
  isModal?: boolean
  onClose?: () => void
  onVoteChange?: (slug: string, nextCount: number) => void
}) {
  const [views, setViews] = useState(rule.views ?? 0)
  const dateText = formatToolAddedDate(rule.date)
  const primaryTag = rule.tags[0] || 'Open Source'
  const descriptionText = rule.description?.trim() || rule.content?.trim() || primaryTag

  function handleOutboundClick() {
    trackListingEvent(
      'outbound_clicked',
      {
        listingId: rule.slug,
        listingName: rule.title,
        listingPosition: 0,
        source: 'tool_detail',
      },
      getOutboundEventParameters(rule.url ?? ''),
    )

    try {
      const key = `rehubber:viewed:v2:${rule.slug}`
      if (typeof window !== 'undefined' && !window.sessionStorage.getItem(key)) {
        window.sessionStorage.setItem(key, '1')
        setViews((prev) => prev + 1)

        import('@/lib/firebase-client')
          .then(async ({ getFirebaseAppCheckToken, getFirebaseClientFirestore }) => {
            await getFirebaseAppCheckToken().catch(() => '')
            const { doc, updateDoc, increment } = await import('firebase/firestore')
            const db = getFirebaseClientFirestore()
            await updateDoc(doc(db, 'rules', rule.slug), { views: increment(1) })
          })
          .catch(() => {})
      }
    } catch {
      // Ignore session storage failures
    }
  }

  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {rule.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-border bg-secondary/70 px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {rule.title}
          </h1>
        </div>

        <UpvoteButton
          slug={rule.slug}
          title={rule.title}
          source="tool_detail"
          initialCount={rule.upvotes ?? 0}
          onVoteChange={onVoteChange}
        />
      </div>

      <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        {descriptionText}
      </p>

      {rule.content && rule.content.trim() !== descriptionText && (
        <div className="rounded-xl border border-border/70 bg-secondary/30 p-4 text-xs leading-relaxed text-foreground/90">
          {rule.content}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
          {dateText && (
            <span className="inline-flex items-center gap-1.5">
              <History className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
              <span>Added {dateText}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Eye className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
            <span className="tabular-nums">{views.toLocaleString()} views</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ShareMenu
            slug={rule.slug}
            title={rule.title}
            description={descriptionText}
            source="tool_detail"
          />

          {rule.url && (
            <a
              href={rule.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOutboundClick}
              onAuxClick={handleOutboundClick}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <span>Visit Tool</span>
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
        {isModal && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to directory</span>
          </button>
        ) : (
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to directory</span>
          </Link>
        )}
      </div>
    </article>
  )
}
