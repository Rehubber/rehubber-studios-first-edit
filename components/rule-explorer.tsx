'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckSquare, LoaderCircle, Shield, Square, Trash2, X } from 'lucide-react'
import { EmailSubscribeCard } from '@/components/email-subscribe-card'
import { RuleCard } from '@/components/rule-card'
import { useAdmin } from '@/components/admin-context'
import type { DirectoryPage } from '@/lib/types'

const DIRECTORY_CACHE_PREFIX = 'rehubber:directory-page:v1:'
const DIRECTORY_CACHE_TTL_MS = 60 * 60 * 1000

function isDirectoryPage(value: unknown): value is DirectoryPage {
  if (!value || typeof value !== 'object') return false
  const page = value as Partial<DirectoryPage>
  return Array.isArray(page.rules) && Number.isSafeInteger(page.page) && typeof page.hasMore === 'boolean'
}

async function loadDirectoryPage(pageNumber: number): Promise<DirectoryPage> {
  const cacheKey = `${DIRECTORY_CACHE_PREFIX}${pageNumber}`
  try {
    const stored = window.localStorage.getItem(cacheKey)
    if (stored) {
      const cached: unknown = JSON.parse(stored)
      if (
        cached &&
        typeof cached === 'object' &&
        typeof (cached as { savedAt?: unknown }).savedAt === 'number' &&
        Date.now() - (cached as { savedAt: number }).savedAt < DIRECTORY_CACHE_TTL_MS &&
        isDirectoryPage((cached as { pageData?: unknown }).pageData)
      ) {
        return (cached as { pageData: DirectoryPage }).pageData
      }
    }
  } catch {
    // A disabled or full localStorage must not prevent loading the directory.
  }

  const response = await fetch(`/directory/pages/page-${pageNumber}.json`)
  const data: unknown = await response.json()
  if (!response.ok || !isDirectoryPage(data) || data.page !== pageNumber) {
    throw new Error('Could not load this directory page. Please try again.')
  }

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), pageData: data }))
  } catch {
    // The CDN remains the source of truth when browser storage is unavailable.
  }
  return data
}

export function RuleExplorer({ initialPage }: { initialPage: DirectoryPage }) {
  const [rules, setRules] = useState(initialPage.rules)
  const [hasMore, setHasMore] = useState(initialPage.hasMore)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const currentPage = initialPage.page
  const [loadedPage, setLoadedPage] = useState(currentPage)

  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<string | null>(null)

  const { isAdminMode, selectedSlugs, selectAllSlugs, deselectAll, deletedSlugs, markDeletedLocally } = useAdmin()

  // Filter out any tools that were deleted locally
  const visibleRules = rules.filter((rule) => !deletedSlugs.has(rule.slug))

  async function loadMore() {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    setLoadError(null)

    try {
      const page = await loadDirectoryPage(loadedPage + 1)

      setRules((current) => {
        const knownSlugs = new Set(current.map((rule) => rule.slug))
        return [...current, ...page.rules.filter((rule) => !knownSlugs.has(rule.slug))]
      })
      setLoadedPage(page.page)
      setHasMore(page.hasMore)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load more rules.')
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleDeleteSelected() {
    if (selectedSlugs.size === 0 || bulkDeleting) return
    setBulkDeleting(true)
    setBulkStatus(`Deleting ${selectedSlugs.size} selected tools from Cloud Firestore...`)

    const slugsToDelete = Array.from(selectedSlugs)
    try {
      const { getFirebaseClientFirestore } = await import('@/lib/firebase-client')
      const { doc, writeBatch } = await import('firebase/firestore')
      const db = getFirebaseClientFirestore()

      const CHUNK = 150
      for (let i = 0; i < slugsToDelete.length; i += CHUNK) {
        const chunk = slugsToDelete.slice(i, i + CHUNK)
        const batch = writeBatch(db)
        for (const slug of chunk) {
          batch.delete(doc(db, 'rules', slug))
        }
        await batch.commit()
      }

      markDeletedLocally(slugsToDelete)
      setBulkStatus(`Successfully deleted ${slugsToDelete.length} tools!`)
      setTimeout(() => setBulkStatus(null), 3000)
      setConfirmBulk(false)
    } catch (err) {
      console.error('Bulk delete error:', err)
      markDeletedLocally(slugsToDelete)
      setBulkStatus(`Removed ${slugsToDelete.length} tools from view.`)
      setTimeout(() => setBulkStatus(null), 3000)
      setConfirmBulk(false)
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <section id="rules" aria-labelledby="rules-heading" className="mx-auto flex max-w-7xl scroll-mt-20 flex-col px-4 pt-1 pb-24 sm:px-6 lg:px-8">
      <h2 id="rules-heading" className="sr-only">
        Rules Directory
      </h2>

      {/* Admin Floating Bulk Action Bar */}
      {isAdminMode && (
        <div className="sticky top-16 z-30 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-card/95 p-3.5 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <Shield className="size-4" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground">
                Admin Selection Mode
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {selectedSlugs.size} tool{selectedSlugs.size === 1 ? '' : 's'} selected
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => selectAllSlugs(visibleRules.map((r) => r.slug))}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 text-xs font-medium text-foreground hover:bg-secondary cursor-pointer"
            >
              <CheckSquare className="size-3.5 text-primary" />
              <span>Select All Visible ({visibleRules.length})</span>
            </button>

            {selectedSlugs.size > 0 && (
              <button
                type="button"
                onClick={deselectAll}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                <Square className="size-3.5" />
                <span>Deselect All</span>
              </button>
            )}

            {selectedSlugs.size > 0 && (
              <>
                {!confirmBulk ? (
                  <button
                    type="button"
                    onClick={() => setConfirmBulk(true)}
                    disabled={bulkDeleting}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-destructive px-3 text-xs font-semibold text-destructive-foreground shadow-xs hover:bg-destructive/90 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Delete Selected ({selectedSlugs.size})</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      disabled={bulkDeleting}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-destructive px-3 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 cursor-pointer disabled:opacity-50"
                    >
                      {bulkDeleting ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      <span>{bulkDeleting ? 'Deleting…' : `Confirm Delete (${selectedSlugs.size})`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmBulk(false)}
                      disabled={bulkDeleting}
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {bulkStatus && (
            <div className="w-full text-xs font-mono text-amber-400">
              {bulkStatus}
            </div>
          )}
        </div>
      )}

      {visibleRules.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(() => {
            const insertIndex = Math.min(12, visibleRules.length)
            const cards: React.ReactNode[] = []
            visibleRules.forEach((rule, idx) => {
              if (idx === insertIndex) {
                cards.push(
                  <li key="email-subscribe-card" className="flex">
                    <div className="flex w-full flex-col [&>article]:flex-1">
                      <EmailSubscribeCard />
                    </div>
                  </li>,
                )
              }
              cards.push(
                <li key={rule.slug} className="flex">
                  <div className="flex w-full flex-col [&>article]:flex-1">
                    <RuleCard rule={rule} density="compact" />
                  </div>
                </li>,
              )
            })
            if (visibleRules.length <= insertIndex) {
              cards.push(
                <li key="email-subscribe-card" className="flex">
                  <div className="flex w-full flex-col [&>article]:flex-1">
                    <EmailSubscribeCard />
                  </div>
                </li>,
              )
            }
            return cards
          })()}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <p className="font-mono text-sm">No rules found.</p>
          <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            Be the first to submit an open source tool or rule for review.
          </p>
          <div className="flex gap-2">
            <Link
              href="/submit/"
              className="flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Submit a tool
            </Link>
          </div>
        </div>
      )}

      {loadError && (
        <p role="alert" className="text-center text-sm text-destructive">
          {loadError}
        </p>
      )}

      {hasMore && (
        <div className="flex justify-center pt-6">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="flex h-10 items-center gap-2 rounded-md border border-border px-4 text-xs font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {loadingMore && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {loadingMore ? 'Loading…' : 'Load more tools'}
          </button>
        </div>
      )}
    </section>
  )
}
