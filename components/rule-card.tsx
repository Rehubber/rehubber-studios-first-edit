'use client'

import { useState } from 'react'
import { Check, CheckSquare, ExternalLink, Eye, History, LoaderCircle, Share2, Sparkles, Square, Trash2, X } from 'lucide-react'
import { UpvoteButton } from '@/components/upvote-button'
import { useAdmin } from '@/components/admin-context'
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { isAdminMode, isSlugSelected, toggleSelectSlug, markDeletedLocally } = useAdmin()

  const isSelected = isSlugSelected(rule.slug)
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

  async function handleDeleteSingle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (isDeleting) return

    setIsDeleting(true)
    try {
      const { getFirebaseClientFirestore } = await import('@/lib/firebase-client')
      const { doc, deleteDoc } = await import('firebase/firestore')
      const db = getFirebaseClientFirestore()
      await deleteDoc(doc(db, 'rules', rule.slug))
      markDeletedLocally([rule.slug])
    } catch (err) {
      console.error('Failed to delete tool from Firestore:', err)
      // Still remove locally to respect admin command
      markDeletedLocally([rule.slug])
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  function handleCheckboxToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    toggleSelectSlug(rule.slug)
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
    <article
      className={`group relative flex h-full min-h-[110px] flex-col justify-between overflow-hidden rounded-xl border bg-card px-4 pt-2.5 pb-2 transition-all duration-150 ${
        isSelected
          ? 'border-destructive/80 bg-destructive/5 ring-2 ring-destructive/40 shadow-sm'
          : isAdminMode
            ? 'border-border/90 hover:border-amber-500/50 hover:bg-card/90'
            : 'border-border hover:border-primary/40 hover:bg-card/90'
      }`}
    >
      {/* Admin Mode Overlay Bar */}
      {isAdminMode && (
        <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-1.5">
          <button
            type="button"
            onClick={handleCheckboxToggle}
            className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
            title={isSelected ? 'Deselect this tool' : 'Select this tool for bulk delete'}
          >
            {isSelected ? (
              <CheckSquare className="size-3.5 text-destructive" />
            ) : (
              <Square className="size-3.5 text-muted-foreground" />
            )}
            <span className={isSelected ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
              {isSelected ? 'Selected' : 'Select'}
            </span>
          </button>

          {!confirmDelete ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setConfirmDelete(true)
              }}
              className="inline-flex h-5 items-center gap-1 rounded bg-destructive/10 px-1.5 text-[9px] font-medium text-destructive transition-colors hover:bg-destructive/20 cursor-pointer"
              title="Delete this tool from Firestore"
            >
              <Trash2 className="size-2.5" />
              <span>Delete</span>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleDeleteSingle}
                disabled={isDeleting}
                className="inline-flex h-5 items-center gap-1 rounded bg-destructive px-1.5 text-[9px] font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <LoaderCircle className="size-2.5 animate-spin" /> : <Trash2 className="size-2.5" />}
                <span>Confirm</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setConfirmDelete(false)
                }}
                className="inline-flex size-5 items-center justify-center rounded border border-border text-[9px] text-muted-foreground hover:bg-secondary cursor-pointer"
              >
                <X className="size-2.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <CardWrapper {...wrapperProps} className="flex flex-1 flex-col gap-1.5 focus:outline-none cursor-pointer">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-pretty text-[11px] font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary transition-colors">
            {rule.title}
          </h3>
          {isExternal && (
            <ExternalLink
              className="mt-0.5 size-3 shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          <Sparkles className="size-3 text-muted-foreground/80 group-hover:text-primary transition-colors" aria-hidden="true" />
          <span>{primaryTag}</span>
        </div>
      </CardWrapper>

      <footer className="mt-2 flex items-center justify-between gap-1 text-muted-foreground">
        <div className="flex items-center gap-1.5 font-mono text-[8px] font-medium text-muted-foreground/80">
          <div className="flex items-center gap-1" title={`Added on ${dateText}`}>
            <History className="size-2.5 text-muted-foreground/60" aria-hidden="true" />
            <span>{dateText}</span>
          </div>

          <span className="text-muted-foreground/30 text-[6px]" aria-hidden="true">•</span>

          <div className="flex items-center gap-1 text-muted-foreground/75" title={`${views.toLocaleString()} views`}>
            <Eye className="size-2.5 text-muted-foreground/60" aria-hidden="true" />
            <span>{formatViews(views)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[8px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={`Share ${rule.title}`}
          >
            {copied ? (
              <>
                <Check className="size-2.5 text-emerald-500" aria-hidden="true" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Share2 className="size-2.5" aria-hidden="true" />
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
