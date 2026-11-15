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
  const sa = JSON.parse(serviceAccountJson)
  credential = cert(sa)
} else if (projectId && clientEmail && privateKey) {
  credential = cert({ projectId, clientEmail, privateKey })
}

if (!projectId || !credential) {
  throw new Error(
    'Set FIREBASE_PROJECT_ID and either FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY before seeding.',
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
const rulesDirectory = path.join(root, 'content', 'rules')
const files = (await readdir(rulesDirectory)).filter((file) => file.endsWith('.json'))

console.log(`Starting seed of ${files.length} tools into Firestore collection '${collectionName}'...`)

const BATCH_SIZE = 400
let imported = 0

for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const chunk = files.slice(i, i + BATCH_SIZE)
  const batch = db.batch()

  for (const file of chunk) {
    const slug = file.replace(/\.json$/, '')
    const data = JSON.parse(await readFile(path.join(rulesDirectory, file), 'utf8'))
    const ruleRef = db.collection(collectionName).doc(slug)

    batch.set(
      ruleRef,
      {
        ...data,
        slug,
        status: 'published',
        upvotes: typeof data.upvotes === 'number' ? data.upvotes : 0,
        views: typeof data.views === 'number' ? data.views : 0,
        source: 'local-seed',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    imported += 1
  }

  await batch.commit()
  console.log(`Committed batch: ${imported}/${files.length} tools.`)
}

console.log(`Seed complete: successfully imported ${imported} tools into Firestore!`)
