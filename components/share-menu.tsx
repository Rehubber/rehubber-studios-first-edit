'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Check, Copy, ExternalLink, Share2, X } from 'lucide-react'
import posthog from 'posthog-js'

function buildShareOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'https://www.rehubber.com'
}

async function copyTextWithFallback(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Cross-origin iframe fallback below
    }
  }

  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  }

  return false
}

export function ShareMenu({
  slug,
  title,
  description,
  compact = false,
}: {
  slug: string
  title: string
  description?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const origin = buildShareOrigin()
  const shareUrl = `${origin}/tool/${slug}/`
  const homepageToolUrl = `/?tool=${encodeURIComponent(slug)}`
  const shareText = description ? `${title} — ${description}` : `Check out ${title} on Rehubber`

  function trackShare(method: string) {
    try {
      posthog.capture('tool_shared', {
        tool_slug: slug,
        share_method: method,
        share_format: 'page',
      })
    } catch {
      // Never break UI if analytics fails
    }
  }

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const ok = await copyTextWithFallback(shareUrl)
    if (ok) {
      setCopyFailed(false)
      setCopied(true)
      trackShare('clipboard')
      setTimeout(() => setCopied(false), 1800)
    } else {
      setCopyFailed(true)
    }
  }

  async function handleNativeShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!navigator.share) return
    try {
      await navigator.share({
        title: `${title} · Rehubber`,
        text: shareText,
        url: shareUrl,
      })
      trackShare('native')
      setOpen(false)
    } catch {
      // User dismissed share sheet
    }
  }

  async function handleShareButtonClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${title} · Rehubber`,
          text: shareText,
          url: shareUrl,
        })
        trackShare('native')
        return
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
      }
    }

    setOpen((prev) => !prev)
  }

  function buildSocialUrl(platform: 'x' | 'linkedin' | 'reddit'): string {
    const encodedUrl = encodeURIComponent(shareUrl)
    const encodedText = encodeURIComponent(`${title} on Rehubber`)
    if (platform === 'x') {
      return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`
    }
    if (platform === 'linkedin') {
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    }
    return `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`
  }

  const modalContent =
    open && mounted
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Share ${title}`}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-xs"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 text-xs shadow-2xl"
            >
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/70 pb-2.5">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Share card on Rehubber
                  </span>
                  <span className="text-sm font-semibold text-foreground line-clamp-1">{title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close share menu"
                  className="inline-flex size-7 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>

              {/* Selectable URL + Copy */}
              <div className="mb-3 flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Share URL"
                  className="h-8 min-w-0 flex-1 rounded-md border border-input bg-secondary/50 px-2.5 font-mono text-[10.5px] text-foreground focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" aria-hidden="true" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {copyFailed && (
                <p className="mb-2 text-[10.5px] text-amber-400">
                  Clipboard access is restricted here — select and copy the link above directly.
                </p>
              )}

              <div className="flex flex-col gap-1">
                <a
                  href={buildSocialUrl('x')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackShare('x')}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <span>Share on X (Twitter)</span>
                  <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </a>

                <a
                  href={buildSocialUrl('linkedin')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackShare('linkedin')}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <span>Share on LinkedIn</span>
                  <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </a>

                <a
                  href={buildSocialUrl('reddit')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackShare('reddit')}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <span>Share on Reddit</span>
                  <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </a>

                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-secondary cursor-pointer"
                  >
                    <span>More share apps…</span>
                    <Share2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="mt-3 border-t border-border/70 pt-2.5">
                <Link
                  href={homepageToolUrl}
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
                >
                  <span>Find this tool on the homepage</span>
                  <ExternalLink className="size-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative z-10 inline-flex">
      <button
        type="button"
        onClick={handleShareButtonClick}
        className={
          compact
            ? 'inline-flex h-5 items-center gap-1 rounded-full border border-border/70 bg-secondary/70 px-2 text-[8.5px] font-medium leading-none text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground cursor-pointer'
            : 'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-secondary/70 px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary cursor-pointer'
        }
        aria-label={`Share ${title}`}
        aria-expanded={open}
      >
        <Share2 className={compact ? 'size-2.5' : 'size-3.5'} aria-hidden="true" />
        <span>Share</span>
      </button>

      {modalContent}
    </div>
  )
}
