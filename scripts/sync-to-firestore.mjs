import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { loadEnvConfig } = nextEnv
loadEnvConfig(root)

const clean = (v) => (v ? String(v).trim().replace(/^['"]+|['"]+$/g, '') : '')
const projectId = clean(process.env.FIREBASE_PROJECT_ID)
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL)
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/\\n/g, '\n')

let credential
if (serviceAccountJson) {
  credential = cert(JSON.parse(serviceAccountJson))
} else if (projectId && clientEmail && privateKey) {
  credential = cert({ projectId, clientEmail, privateKey })
}

if (!projectId || !credential) {
  throw new Error(
    'Admin SDK credentials required so firestore.rules never have to be opened. Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY).',
  )
}

const app =
  getApps()[0] ??
  initializeApp({
    credential,
    projectId,
  })

const db = getFirestore(app)
const collectionName = process.env.FIRESTORE_RULES_COLLECTION?.trim() || 'rules'
const rulesDir = path.join(root, 'content', 'rules')
const files = (await readdir(rulesDir)).filter((f) => f.endsWith('.json'))

console.log(`Syncing ${files.length} tools to ${projectId} (${collectionName}) via Firebase Admin SDK...`)

const BATCH_SIZE = 150
let totalUploaded = 0

for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const chunk = files.slice(i, i + BATCH_SIZE)
  const batch = db.batch()

  for (const file of chunk) {
    const slug = file.replace(/\.json$/, '')
    const data = JSON.parse(await readFile(path.join(rulesDir, file), 'utf8'))
    const docRef = db.collection(collectionName).doc(slug)

    batch.set(
      docRef,
      {
        slug,
        title: typeof data.title === 'string' ? data.title : slug,
        description: typeof data.description === 'string' ? data.description : '',
        content: typeof data.content === 'string' ? data.content : '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        author: typeof data.author === 'object' && data.author ? data.author : { name: data.authorName || 'directory' },
        url: typeof data.url === 'string' ? data.url : '',
        ...(typeof data.sortOrder === 'number' ? { sortOrder: data.sortOrder } : {}),
        date: typeof data.date === 'string' ? data.date : '',
        status: 'published',
        upvotes: typeof data.upvotes === 'number' ? data.upvotes : 0,
        views: typeof data.views === 'number' ? data.views : 0,
        source: 'local-seed',
        syncedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }

  await batch.commit()
  totalUploaded += chunk.length
  console.log(`Uploaded batch: ${totalUploaded} / ${files.length} tools...`)
}

console.log(`Successfully synced all ${totalUploaded} tools to ${projectId} (${collectionName}).`)
process.exit(0)
