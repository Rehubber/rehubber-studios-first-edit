'use client'

import Link from 'next/link'
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useAdmin } from '@/components/admin-context'

export function SiteHeader() {
  const { isAdminMode, toggleAdminMode } = useAdmin()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="font-mono text-base font-bold tracking-tight text-foreground transition-colors hover:text-primary"
        >
          Rehubber
        </Link>
        <div className="flex items-center gap-2">
          {/* Admin Mode Browser Toggle */}
          <button
            type="button"
            onClick={toggleAdminMode}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-all cursor-pointer ${
              isAdminMode
                ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300 shadow-xs ring-1 ring-amber-500/20'
                : 'border border-border/70 bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
            title={isAdminMode ? 'Click to disable browser Admin Mode' : 'Click to enable browser Admin Mode'}
          >
            {isAdminMode ? (
              <>
                <ShieldCheck className="size-3.5 text-amber-400" />
                <span>Admin Mode: ON</span>
              </>
            ) : (
              <>
                <Shield className="size-3.5" />
                <span>Admin Mode</span>
              </>
            )}
          </button>

          <Link
            href="/admin/"
            className="rounded-md border border-border/80 bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-secondary hover:text-primary"
          >
            Dashboard
          </Link>
          <Link
            href="/support/"
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Support
          </Link>
        </div>
      </div>
    </header>
  )
}
