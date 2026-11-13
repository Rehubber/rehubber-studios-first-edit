'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import posthog from 'posthog-js'
import { getFirebaseClientAuth, isFirebaseConfigured } from '@/lib/firebase-client'

interface AdminContextType {
  isAdminMode: boolean
  toggleAdminMode: () => void
  setAdminMode: (active: boolean) => void
  selectedSlugs: Set<string>
  toggleSelectSlug: (slug: string) => void
  selectAllSlugs: (slugs: string[]) => void
  deselectAll: () => void
  isSlugSelected: (slug: string) => boolean
  deletedSlugs: Set<string>
  markDeletedLocally: (slugs: string[]) => void
}

const AdminContext = createContext<AdminContextType | null>(null)

const ADMIN_MODE_STORAGE_KEY = 'rehubber:admin_mode_enabled'
const DELETED_SLUGS_STORAGE_KEY = 'rehubber:deleted_tools_local'

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false)
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set())
  const [deletedSlugs, setDeletedSlugs] = useState<Set<string>>(new Set())
  const identifiedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured()) return

    try {
      return onAuthStateChanged(getFirebaseClientAuth(), (user) => {
        if (user) {
          if (identifiedUserId.current && identifiedUserId.current !== user.uid) {
            posthog.reset()
          }

          if (identifiedUserId.current !== user.uid) {
            posthog.identify(user.uid, {
              ...(user.email ? { email: user.email } : {}),
              ...(user.displayName ? { name: user.displayName } : {}),
            })
            identifiedUserId.current = user.uid
          }
        } else if (identifiedUserId.current) {
          posthog.reset()
          identifiedUserId.current = null
        }
      })
    } catch {
      // Firebase Authentication is optional for the public application.
    }
  }, [])

  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem(ADMIN_MODE_STORAGE_KEY)
      if (savedMode === 'true') {
        setIsAdminMode(true)
      }
      const savedDeleted = window.localStorage.getItem(DELETED_SLUGS_STORAGE_KEY)
      if (savedDeleted) {
        const parsed = JSON.parse(savedDeleted)
        if (Array.isArray(parsed)) {
          setDeletedSlugs(new Set(parsed))
        }
      }
    } catch {
      // Storage unavailable in restricted sandbox
    }
  }, [])

  function toggleAdminMode() {
    setIsAdminMode((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(ADMIN_MODE_STORAGE_KEY, String(next))
      } catch {
        // Storage errors ignored
      }
      return next
    })
  }

  function setAdminMode(active: boolean) {
    setIsAdminMode(active)
    try {
      window.localStorage.setItem(ADMIN_MODE_STORAGE_KEY, String(active))
    } catch {
      // Storage errors ignored
    }
  }

  function toggleSelectSlug(slug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) {
        next.delete(slug)
      } else {
        next.add(slug)
      }
      return next
    })
  }

  function selectAllSlugs(slugs: string[]) {
    setSelectedSlugs(new Set(slugs))
  }

  function deselectAll() {
    setSelectedSlugs(new Set())
  }

  function isSlugSelected(slug: string) {
    return selectedSlugs.has(slug)
  }

  function markDeletedLocally(slugs: string[]) {
    setDeletedSlugs((prev) => {
      const next = new Set(prev)
      slugs.forEach((slug) => next.add(slug))
      try {
        window.localStorage.setItem(DELETED_SLUGS_STORAGE_KEY, JSON.stringify(Array.from(next)))
        // Also invalidate any cached directory pages in localStorage
        const keysToRemove: string[] = []
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key && key.startsWith('rehubber:directory-page:')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach((key) => window.localStorage.removeItem(key))
      } catch {
        // Storage errors ignored
      }
      return next
    })
    setSelectedSlugs((prev) => {
      const next = new Set(prev)
      slugs.forEach((slug) => next.delete(slug))
      return next
    })
  }

  return (
    <AdminContext.Provider
      value={{
        isAdminMode,
        toggleAdminMode,
        setAdminMode,
        selectedSlugs,
        toggleSelectSlug,
        selectAllSlugs,
        deselectAll,
        isSlugSelected,
        deletedSlugs,
        markDeletedLocally,
      }}
    >
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) {
    return {
      isAdminMode: false,
      toggleAdminMode: () => {},
      setAdminMode: () => {},
      selectedSlugs: new Set<string>(),
      toggleSelectSlug: () => {},
      selectAllSlugs: () => {},
      deselectAll: () => {},
      isSlugSelected: () => false,
      deletedSlugs: new Set<string>(),
      markDeletedLocally: () => {},
    }
  }
  return ctx
}
