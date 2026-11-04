'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { LoaderCircle, Search, X } from 'lucide-react'
import { RuleCard } from '@/components/rule-card'
import type { DirectoryPage, Rule } from '@/lib/types'
import { cn } from '@/lib/utils'

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

function matches(rule: Rule, terms: string[]) {
  const haystack = `${rule.title} ${rule.description} ${rule.tags.join(' ')} ${rule.content}`.toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

function getTags(rules: Rule[]) {
  const counts = new Map<string, number>()
  for (const rule of rules) {
    for (const tag of rule.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag)
}

export function RuleExplorer({ initialPage }: { initialPage: DirectoryPage }) {
  const [rules, setRules] = useState(initialPage.rules)
  const [hasMore, setHasMore] = useState(initialPage.hasMore)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const currentPage = initialPage.page
  const [loadedPage, setLoadedPage] = useState(currentPage)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [density, setDensity] = useState<'compact' | 'balanced' | 'spacious'>('compact')
  const deferredQuery = useDeferredValue(query)
  const inputRef = useRef<HTMLInputElement>(null)
  const tags = useMemo(() => getTags(rules), [rules])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const isTyping = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const filtered = useMemo(() => {
    const terms = deferredQuery.toLowerCase().split(/\s+/).filter(Boolean)
    return rules.filter((rule) => (!activeTag || rule.tags.includes(activeTag)) && matches(rule, terms))
  }, [rules, deferredQuery, activeTag])

  function reset() {
    setQuery('')
    setActiveTag(null)
    inputRef.current?.focus()
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

  return (
    <section id="rules" aria-labelledby="rules-heading" className="mx-auto flex max-w-6xl scroll-mt-20 flex-col gap-6 px-4 pb-24 sm:px-6">
      <h2 id="rules-heading" className="sr-only">
        Rules
      </h2>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="rule-search" className="sr-only">
            Search rules
          </label>
          <input
            ref={inputRef}
            id="rule-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('')
            }}
            placeholder="Search frameworks, languages, or rule content…"
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full rounded-xl border border-input bg-card pl-11 pr-20 text-sm placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Clear search</span>
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-secondary px-1.5 font-mono text-xs text-muted-foreground sm:block">
              /
            </kbd>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Filter by tag">
          <TagButton active={activeTag === null} onClick={() => setActiveTag(null)}>
            All
          </TagButton>
          {tags.map((tag) => (
            <TagButton key={tag} active={activeTag === tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}>
              {tag}
            </TagButton>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p aria-live="polite" className="font-mono text-xs text-muted-foreground">
          {filtered.length === rules.length
            ? `Showing ${rules.length} loaded rules`
            : `${filtered.length} of ${rules.length} loaded rules match`}
        </p>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-card/60 p-1 text-xs font-mono" role="group" aria-label="Grid spacing density">
          <span className="px-2 text-muted-foreground">Spacing:</span>
          {(['compact', 'balanced', 'spacious'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDensity(mode)}
              className={cn(
                'capitalize rounded px-2.5 py-0.5 transition-colors',
                density === mode
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      {hasMore && (
        <p className="-mt-4 text-center text-xs text-muted-foreground">
          Load more to include additional rules in search and tag filters.
        </p>
      )}

      {filtered.length > 0 ? (
        <ul
          className={cn(
            'grid md:grid-cols-2 lg:grid-cols-3 transition-all duration-200',
            density === 'compact' && 'gap-3.5 sm:gap-4',
            density === 'balanced' && 'gap-5 sm:gap-6',
            density === 'spacious' && 'gap-7 lg:gap-8'
          )}
        >
          {filtered.map((rule) => (
            <li key={rule.slug} className="flex">
              <div className="flex w-full flex-col [&>article]:flex-1">
                <RuleCard rule={rule} density={density} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <p className="font-mono text-sm">{hasMore ? 'No matching rules in the loaded results.' : 'No rules found.'}</p>
          <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            {hasMore
              ? 'Load more to search additional rules, or clear the filters.'
              : 'Nobody has written rules for that yet. Be the first to submit one for review.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="h-9 rounded-md border border-border px-3 text-sm hover:bg-secondary"
            >
              Clear filters
            </button>
            <Link
              href="/submit"
              className="flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Submit a rule
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
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {loadingMore ? 'Loading…' : 'Load more rules'}
          </button>
        </div>
      )}
    </section>
  )
}

function TagButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-7 rounded-full border px-3 font-mono text-xs transition-colors',
        active
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
