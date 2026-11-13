import { readdir, readFile, mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { loadEnvConfig } = nextEnv
loadEnvConfig(root)

const pageSize = 16
const rulesDirectory = path.join(root, 'content', 'rules')
const outputDirectory = path.join(root, 'public', 'directory')
const outputPagesDirectory = path.join(outputDirectory, 'pages')
const localOnly = process.argv.includes('--local')
const requireFirestore = process.argv.includes('--require-firestore')

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatAddedDate(value) {
  if (!value) return undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(trimmed)) return trimmed
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getUTCDate()} ${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`
    }
    return trimmed
  }
  if (typeof value === 'object' && value !== null) {
    if (typeof value.toDate === 'function') {
      const d = value.toDate()
      if (!Number.isNaN(d.getTime())) {
        return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
      }
    } else if (typeof value.seconds === 'number') {
      const d = new Date(value.seconds * 1000)
      if (!Number.isNaN(d.getTime())) {
        return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
      }
    }
  }
  return undefined
}

function normalizeRule(data, slug) {
  const title = typeof data.title === 'string' ? data.title : ''
  const content = typeof data.content === 'string' ? data.content : ''
  if (!title) return null

  const tags = Array.isArray(data.tags) ? data.tags.filter((tag) => typeof tag === 'string') : []
  const authorName =
    typeof data.author?.name === 'string'
      ? data.author.name
      : typeof data.authorName === 'string'
        ? data.authorName
        : 'directory'
  const authorUrl =
    typeof data.author?.url === 'string'
      ? data.author.url
      : typeof data.authorUrl === 'string'
        ? data.authorUrl
        : undefined

  const upvotes =
    typeof data.upvotes === 'number' && Number.isFinite(data.upvotes) && data.upvotes >= 0
      ? Math.floor(data.upvotes)
      : 0
  const views =
    typeof data.views === 'number' && Number.isFinite(data.views) && data.views >= 0
      ? Math.floor(data.views)
      : 0
  const date =
    formatAddedDate(data.date) ||
    formatAddedDate(data.approvedAt) ||
    formatAddedDate(data.createdAt) ||
    formatAddedDate(data.syncedAt)

  return {
    slug,
    title,
    description: typeof data.description === 'string' ? data.description : '',
    tags,
    author: { name: authorName, ...(authorUrl ? { url: authorUrl } : {}) },
    content,
    upvotes,
    views,
    ...(date ? { date } : {}),
    url: typeof data.url === 'string' ? data.url : undefined,
    showShare: Boolean(data.showShare),
  }
}

async function getLocalRules() {
  const files = (await readdir(rulesDirectory)).filter((file) => file.endsWith('.json'))
  const rules = await Promise.all(
    files.map(async (file) => {
      const data = JSON.parse(await readFile(path.join(rulesDirectory, file), 'utf8'))
      return normalizeRule(data, file.replace(/\.json$/, ''))
    }),
  )
  return rules.filter(Boolean).sort((a, b) => a.slug.localeCompare(b.slug))
}

async function getPublishedRulesFromClientSdk() {
  const configPath = path.join(root, 'firebase-applet-config.json')
  let appletConfig
  try {
    appletConfig = JSON.parse(await readFile(configPath, 'utf8'))
  } catch {
    return null
  }

  if (!appletConfig?.apiKey || !appletConfig?.projectId || !appletConfig?.appId) {
    return null
  }

  const { initializeApp, deleteApp } = await import('@firebase/app')
  const { collection, getDocs, getFirestore, query, where } = await import('@firebase/firestore')

  const app = initializeApp(
    {
      apiKey: appletConfig.apiKey,
      projectId: appletConfig.projectId,
      appId: appletConfig.appId,
    },
    `export-directory-${Date.now()}`,
  )

  try {
    const dbId =
      appletConfig.firestoreDatabaseId && appletConfig.firestoreDatabaseId !== '(default)'
        ? appletConfig.firestoreDatabaseId
        : undefined
    const db = dbId ? getFirestore(app, dbId) : getFirestore(app)
    const collectionName = process.env.FIRESTORE_RULES_COLLECTION?.trim() || 'rules'
    const q = query(collection(db, collectionName), where('status', '==', 'published'))
    const snapshot = await getDocs(q)
    const rules = snapshot.docs
      .map((doc) => normalizeRule(doc.data(), doc.id))
      .filter(Boolean)
      .sort((a, b) => a.slug.localeCompare(b.slug))

    if (!rules.length) {
      if (requireFirestore) {
        throw new Error('Firestore has no published rules; refusing to replace the directory snapshot with an empty export.')
      }
      return null
    }

    console.log(`Exporting ${rules.length} published rules from Cloud Firestore (${appletConfig.projectId}).`)
    return rules
  } finally {
    await deleteApp(app).catch(() => {})
  }
}

async function getPublishedRules() {
  if (localOnly) return getLocalRules()

  try {
    const firestoreRules = await getPublishedRulesFromClientSdk()
    if (firestoreRules && firestoreRules.length > 0) {
      return firestoreRules
    }
  } catch (error) {
    if (requireFirestore) throw error
    console.warn('Could not fetch rules from Cloud Firestore via applet config:', error?.message || error)
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/\\n/g, '\n')

  if (!projectId || (!serviceAccountJson && (!clientEmail || !privateKey))) {
    if (requireFirestore) {
      throw new Error('Production export requires Firebase credentials or applet config; refusing to publish local JSON.')
    }
    console.log('Firebase export credentials are absent; exporting checked-in rule JSON.')
    return getLocalRules()
  }

  let credential
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson)
      if (!serviceAccount || typeof serviceAccount !== 'object' || !serviceAccount.private_key) {
        throw new Error('Service account JSON must be an object with private_key.')
      }
      credential = cert(serviceAccount)
    } catch (error) {
      if (requireFirestore) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON.', { cause: error })
      }
      console.warn('Invalid FIREBASE_SERVICE_ACCOUNT_JSON; exporting checked-in rule JSON.')
      return getLocalRules()
    }
  } else {
    credential = cert({ projectId, clientEmail, privateKey })
  }

  const app =
    getApps()[0] ??
    initializeApp({
      credential,
      projectId,
    })
  try {
    const db = getFirestore(app)
    const collectionName = process.env.FIRESTORE_RULES_COLLECTION?.trim() || 'rules'
    const snapshot = await db
      .collection(collectionName)
      .where('status', '==', 'published')
      .get()
    const rules = snapshot.docs
      .map((doc) => normalizeRule(doc.data(), doc.id))
      .filter(Boolean)
      .sort((a, b) => a.slug.localeCompare(b.slug))

    if (!rules.length) {
      throw new Error('Firestore has no published rules; refusing to replace the directory snapshot with an empty export.')
    }

    return rules
  } finally {
    await app.delete()
  }
}

const rules = await getPublishedRules()
await mkdir(outputPagesDirectory, { recursive: true })
for (const entry of await readdir(outputPagesDirectory, { withFileTypes: true })) {
  if (entry.isFile() && /^page-\d+\.json$/.test(entry.name)) {
    await unlink(path.join(outputPagesDirectory, entry.name))
  }
}

const pageCount = Math.ceil(rules.length / pageSize)
for (let page = 1; page <= pageCount; page += 1) {
  const pageRules = rules.slice((page - 1) * pageSize, page * pageSize)
  const data = {
    rules: pageRules,
    page,
    hasMore: page < pageCount,
  }
  await writeFile(
    path.join(outputPagesDirectory, `page-${page}.json`),
    `${JSON.stringify(data)}\n`,
    'utf8',
  )
}

await writeFile(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify({ pages: pageCount, pageSize, ruleCount: rules.length })}\n`,
  'utf8',
)

await writeFile(
  path.join(outputDirectory, 'catalog-all.json'),
  `${JSON.stringify(rules)}\n`,
  'utf8',
)

console.log(`Exported ${rules.length} rules in ${pageCount} static pages.`)
