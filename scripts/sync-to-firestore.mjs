import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from '@firebase/app'
import { doc, getFirestore, serverTimestamp, writeBatch } from '@firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appletConfig = JSON.parse(await readFile(path.join(root, 'firebase-applet-config.json'), 'utf8'))

console.log('Connecting to project:', appletConfig.projectId, 'database:', appletConfig.firestoreDatabaseId)

const app = initializeApp({
  apiKey: appletConfig.apiKey,
  projectId: appletConfig.projectId,
  appId: appletConfig.appId,
})

const db = getFirestore(app, appletConfig.firestoreDatabaseId)
const rulesDir = path.join(root, 'content', 'rules')
const files = (await readdir(rulesDir)).filter((f) => f.endsWith('.json'))

console.log(`Found ${files.length} tools in content/rules/ to sync to Cloud Firestore...`)

const BATCH_SIZE = 150
let totalUploaded = 0

for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const chunk = files.slice(i, i + BATCH_SIZE)
  const batch = writeBatch(db)

  for (const file of chunk) {
    const slug = file.replace(/\.json$/, '')
    const data = JSON.parse(await readFile(path.join(rulesDir, file), 'utf8'))
    const docRef = doc(db, 'rules', slug)

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
        date: typeof data.date === 'string' ? data.date : '',
        status: 'published',
        upvotes: typeof data.upvotes === 'number' ? data.upvotes : 0,
        views: typeof data.views === 'number' ? data.views : 0,
        source: 'local-seed',
        syncedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  await batch.commit()
  totalUploaded += chunk.length
  console.log(`Uploaded batch: ${totalUploaded} / ${files.length} tools to Firestore...`)
}

console.log(`\n🎉 Successfully synced all ${totalUploaded} tools to Cloud Firestore!`)
process.exit(0)
