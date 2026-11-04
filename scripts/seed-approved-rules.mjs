import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { loadEnvConfig } = nextEnv
loadEnvConfig(root)

const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/\\n/g, '\n')

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY before seeding.')
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  })
const db = getFirestore(app)
const collectionName = process.env.FIRESTORE_RULES_COLLECTION?.trim() || 'rules'
const rulesDirectory = path.join(root, 'content', 'rules')
const files = (await readdir(rulesDirectory)).filter((file) => file.endsWith('.json'))
let imported = 0
let skipped = 0

for (const file of files) {
  const slug = file.replace(/\.json$/, '')
  const data = JSON.parse(await readFile(path.join(rulesDirectory, file), 'utf8'))
  const ruleRef = db.collection(collectionName).doc(slug)

  const wasCreated = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ruleRef)
    if (existing.exists) return false

    transaction.create(ruleRef, {
      ...data,
      slug,
      status: 'published',
      upvotes: 0,
      source: 'local-seed',
      createdAt: FieldValue.serverTimestamp(),
    })
    return true
  })

  if (wasCreated) imported += 1
  else skipped += 1
}

console.log(`Seed complete: ${imported} imported, ${skipped} already existed.`)
