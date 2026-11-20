import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { DirectoryManifest, DirectoryPage, Rule } from './types'
import { getAdminFirestore } from './firebase-admin'

const DIRECTORY_DIR = path.join(process.cwd(), 'public', 'directory')

export const DIRECTORY_PAGE_SIZE = 16

async function enrichRulesWithLiveUpvotes(rules: Rule[]): Promise<Rule[]> {
  const db = getAdminFirestore()
  if (!db) return rules

  try {
    const slugs = rules.map((r) => r.slug)
    const rulesCollection = db.collection('rules')
    const snapshots = await Promise.all(
      slugs.map((slug) => rulesCollection.doc(slug).get())
    )

    const upvotesMap = new Map<string, number>()
    snapshots.forEach((snap) => {
      if (snap.exists) {
        const data = snap.data()
        const upvotes = typeof data?.upvotes === 'number' ? data.upvotes : 0
        upvotesMap.set(snap.id, upvotes)
      }
    })

    return rules.map((rule) => ({
      ...rule,
      upvotes: upvotesMap.get(rule.slug) ?? rule.upvotes ?? 0,
    }))
  } catch (error) {
    console.warn('[directory] Could not fetch live upvotes from Firestore:', error)
    return rules
  }
}

export async function getDirectoryPage(page: number): Promise<DirectoryPage> {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error('The requested directory page is invalid.')
  }

  const filePath = path.join(DIRECTORY_DIR, 'pages', `page-${page}.json`)
  try {
    const pageData = JSON.parse(await fs.readFile(filePath, 'utf8')) as DirectoryPage
    const enrichedRules = await enrichRulesWithLiveUpvotes(pageData.rules)
    return {
      ...pageData,
      rules: enrichedRules,
    }
  } catch (error) {
    console.error(`[directory] Could not read static page ${page}:`, error)
    throw new Error('Static directory data is missing. Run the directory export before building.')
  }
}

export async function getAllRules(): Promise<Rule[]> {
  const filePath = path.join(DIRECTORY_DIR, 'catalog-all.json')
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as Rule[]
  } catch {
    return []
  }
}

export async function getRuleBySlug(slug: string): Promise<Rule | null> {
  const all = await getAllRules()
  return all.find((rule) => rule.slug === slug) ?? null
}

export async function getDirectoryManifest(): Promise<DirectoryManifest> {
  const filePath = path.join(DIRECTORY_DIR, 'manifest.json')
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as DirectoryManifest
  } catch {
    return { pages: 1, pageSize: DIRECTORY_PAGE_SIZE, ruleCount: 0, rulePageBySlug: {} }
  }
}
