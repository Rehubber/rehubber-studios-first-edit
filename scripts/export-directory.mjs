import { readdir, readFile, mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { loadEnvConfig } = nextEnv
loadEnvConfig(root)

const pageSize = 24
const rulesDirectory = path.join(root, 'content', 'rules')
const outputDirectory = path.join(root, 'public', 'directory')
const outputPagesDirectory = path.join(outputDirectory, 'pages')
const localOnly = process.argv.includes('--local')
const requireFirestore = process.argv.includes('--require-firestore')

function normalizeRule(data, slug) {
  const title = typeof data.title === 'string' ? data.title : ''
  const content = typeof data.content === 'string' ? data.content : ''
  if (!title || !content) return null

  const tags = Array.isArray(data.tags) ? data.tags.filter((tag) => typeof tag === 'string') : []
  const authorName =
    typeof data.author?.name === 'string'
      ? data.author.name
      : typeof data.authorName === 'string'
        ? data.authorName
        : 'anonymous'
  const authorUrl =
    typeof data.author?.url === 'string'
      ? data.author.url
      : typeof data.authorUrl === 'string'
        ? data.authorUrl
        : undefined

  return {
    slug,
    title,
    description: typeof data.description === 'string' ? data.description : '',
    tags,
    author: { name: authorName, ...(authorUrl ? { url: authorUrl } : {}) },
    content,
    upvotes: Number.isSafeInteger(data.upvotes) && data.upvotes >= 0 ? data.upvotes : 0,
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

async function getPublishedRules() {
  if (localOnly) return getLocalRules()

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/\\n/g, '\n')

  if (!projectId || (!serviceAccountJson && (!clientEmail || !privateKey))) {
    if (requireFirestore) {
      throw new Error('Production export requires Firebase service-account credentials; refusing to publish local JSON.')
    }
    console.log('Firebase export credentials are absent; exporting checked-in rule JSON.')
    return getLocalRules()
  }

  let credential
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson)
      credential = cert(serviceAccount)
    } catch (error) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON.', { cause: error })
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

console.log(`Exported ${rules.length} rules in ${pageCount} static pages.`)
