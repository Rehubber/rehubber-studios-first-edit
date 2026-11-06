'use client'

import { useState } from 'react'
import { Check, ExternalLink, Eye, History, Share2, Sparkles } from 'lucide-react'
import { UpvoteButton } from '@/components/upvote-button'
import type { Rule } from '@/lib/types'

function formatViews(count: number): string {
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (count >= 1_000) {
    return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  }
  return count.toLocaleString()
}

export function RuleCard({
  rule,
  density = 'compact',
}: {
  rule: Rule
  density?: 'spacious' | 'balanced' | 'compact'
}) {
  const [copied, setCopied] = useState(false)
  const [views, setViews] = useState(rule.views ?? 0)
  const primaryTag = rule.tags[0] || 'AI Tool'
  const dateText = rule.date || '27 Mar 2023'
  const isExternal = Boolean(rule.url)

  function trackView() {
    try {
      const key = `rehubber:viewed:${rule.slug}`
      if (typeof window !== 'undefined' && !window.sessionStorage.getItem(key)) {
        window.sessionStorage.setItem(key, '1')
        setViews((prev) => prev + 1)

        const runUpdate = async () => {
          try {
            const { getFirebaseClientFirestore } = await import('@/lib/firebase-client')
            const { doc, updateDoc, increment } = await import('firebase/firestore')
            const db = getFirebaseClientFirestore()
            const ruleRef = doc(db, 'rules', rule.slug)
            await updateDoc(ruleRef, { views: increment(1) })
          } catch {
            // Non-blocking background analytics
          }
        }

        if ('requestIdleCallback' in window) {
          ;(window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(runUpdate)
        } else {
          setTimeout(runUpdate, 150)
        }
      }
    } catch {
      // Ignore background storage errors
    }
  }

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const shareUrl = rule.url || (typeof window !== 'undefined' ? window.location.href : '')
    try {
      if (navigator.share) {
        await navigator.share({
          title: rule.title,
          text: rule.description || rule.title,
          url: shareUrl,
        })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // User cancelled share dialog
    }
  }

  const CardWrapper = isExternal ? 'a' : 'div'
  const wrapperProps = isExternal
    ? {
        href: rule.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        onClick: trackView,
        onAuxClick: trackView,
      }
    : {
        onClick: trackView,
      }

  return (
    <article className="group relative flex h-full min-h-[148px] flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:bg-card/90">
      <CardWrapper {...wrapperProps} className="flex flex-1 flex-col gap-3 focus:outline-none cursor-pointer">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-pretty text-[15px] font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary transition-colors">
            {rule.title}
          </h3>
          {isExternal && (
            <ExternalLink
              className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="flex items-center">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary/80 px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors group-hover:bg-secondary">
            <Sparkles className="size-3 text-muted-foreground/90 group-hover:text-primary transition-colors" aria-hidden="true" />
            <span>{primaryTag}</span>
          </span>
        </div>
      </CardWrapper>

      <footer className="mt-4 flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/80">
          <div className="flex items-center gap-1" title={`Added on ${dateText}`}>
            <History className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
            <span>{dateText}</span>
          </div>

          <span className="text-muted-foreground/30" aria-hidden="true">•</span>

          <div className="flex items-center gap-1 text-muted-foreground/75" title={`${views.toLocaleString()} views`}>
            <Eye className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
            <span>{formatViews(views)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={`Share ${rule.title}`}
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-500" aria-hidden="true" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Share2 className="size-3" aria-hidden="true" />
                <span>Share</span>
              </>
            )}
          </button>

          <UpvoteButton slug={rule.slug} initialCount={rule.upvotes ?? 0} />
        </div>
      </footer>
    </article>
  )
}
