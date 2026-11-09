'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, History, LoaderCircle, Search, X } from 'lucide-react'
import { EmailSubscribeCard } from '@/components/email-subscribe-card'
import { RuleCard } from '@/components/rule-card'
import type { DirectoryPage } from '@/lib/types'

const DIRECTORY_CACHE_PREFIX = 'rehubber:directory-page:v1:'
const DIRECTORY_CACHE_TTL_MS = 60 * 60 * 1000
const RECENT_SEARCHES_STORAGE_KEY = 'rehubber:recent-searches:v1'
const MAX_RECENT_SEARCHES = 8

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

  // Search & Recent Searches state
  const [searchQuery, setSearchQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Load recent searches on client mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_SEARCHES))
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function saveRecentSearch(term: string) {
    const clean = term.trim()
    if (!clean) return
    setRecentSearches((prev) => {
      const updated = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT_SEARCHES)
      try {
        window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // Ignore localStorage write errors
      }
      return updated
    })
  }

  function removeRecentSearch(termToRemove: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== termToRemove)
      try {
        window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // Ignore localStorage write errors
      }
      return updated
    })
  }

  function clearAllRecentSearches() {
    setRecentSearches([])
    try {
      window.localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
  }

  function handleSelectRecentSearch(term: string) {
    setSearchQuery(term)
    saveRecentSearch(term)
    setIsDropdownOpen(false)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim())
    }
    setIsDropdownOpen(false)
  }

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

  // Filter rules by search term
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const displayRules = normalizedQuery
    ? rules.filter((rule) => {
        const titleMatch = rule.title.toLowerCase().includes(normalizedQuery)
        const tagsMatch = rule.tags.some((t) => t.toLowerCase().includes(normalizedQuery))
        const descMatch = (rule.description || '').toLowerCase().includes(normalizedQuery)
        return titleMatch || tagsMatch || descMatch
      })
    : rules

  return (
    <section id="rules" aria-labelledby="rules-heading" className="mx-auto flex max-w-7xl scroll-mt-20 flex-col gap-6 px-4 pb-24 sm:px-6 lg:px-8">
      <h2 id="rules-heading" className="sr-only">
        Rules Directory
      </h2>

      {/* Search Input with Recent Searches Dropdown */}
      <div ref={searchContainerRef} className="relative mx-auto w-full max-w-md">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsDropdownOpen(false)
            }}
            placeholder="Search tools, tags, or stacks…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-24 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-ring transition-colors shadow-xs"
          />

          <div className="absolute right-1.5 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                }}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-label="Recent Searches"
              aria-expanded={isDropdownOpen}
              className={`flex h-7 items-center gap-1 rounded-md border border-border/80 px-2 text-[11px] font-medium transition-colors ${
                isDropdownOpen ? 'bg-secondary text-primary border-primary/40' : 'bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <History className="size-3" />
              <span className="hidden sm:inline">Recent</span>
              <ChevronDown className={`size-3 transition-transform duration-150 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </form>

        {/* 'Recent Searches' Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-border/80 px-3 py-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Searches
              </span>
              {recentSearches.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllRecentSearches}
                  className="text-[10px] text-muted-foreground/80 hover:text-destructive transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {recentSearches.length > 0 ? (
              <ul className="py-1">
                {recentSearches.map((term) => (
                  <li
                    key={term}
                    className="group flex items-center justify-between px-3 py-1.5 text-xs text-foreground/90 transition-colors hover:bg-secondary cursor-pointer"
                    onClick={() => handleSelectRecentSearch(term)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <History className="size-3 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="truncate">{term}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => removeRecentSearch(term, e)}
                      aria-label={`Remove "${term}" from recent searches`}
                      className="flex size-5 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-card hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-5 text-center text-xs text-muted-foreground">
                No recent searches yet. Type a term above to search.
              </div>
            )}
          </div>
        )}

        {/* Search feedback & clear filter link */}
        {normalizedQuery && (
          <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
            <span>
              Found {displayRules.length} {displayRules.length === 1 ? 'tool' : 'tools'} for &ldquo;{searchQuery}&rdquo;
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-primary underline-offset-4 hover:underline"
            >
              Reset search
            </button>
          </div>
        )}
      </div>

      {displayRules.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(() => {
            const insertIndex = Math.min(12, displayRules.length)
            const cards: React.ReactNode[] = []
            displayRules.forEach((rule, idx) => {
              if (idx === insertIndex && !normalizedQuery) {
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
            if (displayRules.length <= insertIndex && !normalizedQuery) {
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
          <p className="font-mono text-sm">
            {normalizedQuery ? `No tools matched "${searchQuery}"` : 'No rules found.'}
          </p>
          <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            {normalizedQuery
              ? 'Try another keyword, technology, or tag.'
              : 'Be the first to submit an open source tool or rule for review.'}
          </p>
          <div className="flex gap-2">
            {normalizedQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="flex h-9 items-center rounded-md bg-secondary px-4 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
              >
                Clear search
              </button>
            ) : (
              <Link
                href="/submit"
                className="flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Submit a tool
              </Link>
            )}
          </div>
        </div>
      )}

      {loadError && (
        <p role="alert" className="text-center text-sm text-destructive">
          {loadError}
        </p>
      )}

      {hasMore && !normalizedQuery && (
        <div className="flex justify-center pt-4">
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
