import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseCsv,
  toPublishedTool,
  validateCsv,
} from './directory-import-csv.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const reportDirectory = path.join(root, 'import-reports')
const backupDirectory = path.join(root, 'backups')

function parseArguments(values) {
  const options = {
    apply: false,
    file: path.join(root, 'vs tools - Sheet1-import-ready.csv'),
    report: path.join(reportDirectory, `directory-import-${timestamp}.json`),
    confirmProjectId: '',
    restoreBackup: '',
  }

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value === '--help' || value === '-h') {
      options.help = true
    } else if (value === '--apply') {
      options.apply = true
    } else if (value === '--file' || value === '--report' || value === '--restore-backup' || value === '--confirm-replace') {
      const optionValue = values[index + 1]
      if (!optionValue || optionValue.startsWith('--')) {
        throw new Error(`${value} requires a value.`)
      }
      index += 1
      if (value === '--file') options.file = path.resolve(optionValue)
      if (value === '--report') options.report = path.resolve(optionValue)
      if (value === '--restore-backup') options.restoreBackup = path.resolve(optionValue)
      if (value === '--confirm-replace') options.confirmProjectId = optionValue
    } else {
      throw new Error(`Unknown option: ${value}`)
    }
  }

  return options
}

function printHelp() {
  console.log(`Usage:
  npm run import:directory -- --file <csv> [--report <json>]
  npm run import:directory -- --file <csv> --apply --confirm-replace <firebase-project-id>
  npm run import:directory -- --restore-backup <json> --apply --confirm-replace <firebase-project-id>

Without --apply, the command only validates the CSV and writes a report.
Applying always creates a timestamped backup of published Firestore rules first.
`)
}

async function writeReport(reportPath, report) {
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'w' })
}

function serializeFirestoreValue(value) {
  if (value === null || typeof value !== 'object') return value
  if (
    typeof value.toDate === 'function' &&
    Number.isInteger(value.seconds) &&
    Number.isInteger(value.nanoseconds)
  ) {
    return {
      __rehubberBackupType: 'timestamp',
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    }
  }
  if (value instanceof Date) {
    return { __rehubberBackupType: 'date', value: value.toISOString() }
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __rehubberBackupType: 'bytes', value: Buffer.from(value).toString('base64') }
  }
  if (Array.isArray(value)) return value.map(serializeFirestoreValue)
  if (value.constructor?.name === 'GeoPoint') {
    return {
      __rehubberBackupType: 'geoPoint',
      latitude: value.latitude,
      longitude: value.longitude,
    }
  }
  if (value.constructor?.name === 'DocumentReference') {
    return { __rehubberBackupType: 'documentReference', path: value.path }
  }
  const entries = Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, serializeFirestoreValue(nestedValue)]),
  )
  return Object.hasOwn(value, '__rehubberBackupType')
    ? { __rehubberBackupType: 'map', entries }
    : entries
}

function deserializeFirestoreValue(value, { Timestamp, GeoPoint, db }) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((nestedValue) => deserializeFirestoreValue(nestedValue, { Timestamp, GeoPoint, db }))
  }
  if (value.__rehubberBackupType === 'timestamp') {
    return new Timestamp(value.seconds, value.nanoseconds)
  }
  if (value.__rehubberBackupType === 'date') return new Date(value.value)
  if (value.__rehubberBackupType === 'bytes') return Buffer.from(value.value, 'base64')
  if (value.__rehubberBackupType === 'geoPoint') return new GeoPoint(value.latitude, value.longitude)
  if (value.__rehubberBackupType === 'documentReference') return db.doc(value.path)
  if (value.__rehubberBackupType === 'map') {
    return Object.fromEntries(
      Object.entries(value.entries).map(([key, nestedValue]) => [
        key,
        deserializeFirestoreValue(nestedValue, { Timestamp, GeoPoint, db }),
      ]),
    )
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      deserializeFirestoreValue(nestedValue, { Timestamp, GeoPoint, db }),
    ]),
  )
}

function validateBackup(backup, projectId, collectionName) {
  if (
    backup?.version !== 1 ||
    backup.projectId !== projectId ||
    backup.collectionName !== collectionName ||
    !Array.isArray(backup.documents) ||
    backup.documents.length === 0
  ) {
    throw new Error('Backup is empty, malformed, or belongs to a different Firebase project/collection.')
  }

  const ids = new Set()
  for (const document of backup.documents) {
    if (
      typeof document?.id !== 'string' ||
      !document.id ||
      document.id.includes('/') ||
      ids.has(document.id) ||
      document.data?.status !== 'published'
    ) {
      throw new Error('Backup contains an invalid or duplicate published document.')
    }
    ids.add(document.id)
  }
}

async function getFirebaseContext(expectedProjectId) {
  const nextEnv = await import('@next/env')
  const loadEnvConfig = nextEnv.loadEnvConfig ?? nextEnv.default?.loadEnvConfig
  if (typeof loadEnvConfig !== 'function') {
    throw new Error('Could not load Next.js environment configuration from @next/env.')
  }
  loadEnvConfig(root)

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/\\n/g, '\n')
  if (!projectId || projectId !== expectedProjectId) {
    throw new Error('--confirm-replace must exactly match FIREBASE_PROJECT_ID from .env.local.')
  }

  let serviceAccount
  if (serviceAccountJson) {
    try {
      serviceAccount = JSON.parse(serviceAccountJson)
    } catch (error) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON.', { cause: error })
    }
    if (serviceAccount.project_id && serviceAccount.project_id !== projectId) {
      throw new Error('Service account project_id does not match FIREBASE_PROJECT_ID.')
    }
  } else if (!clientEmail || !privateKey) {
    throw new Error(
      'Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local.',
    )
  }

  const [{ cert, initializeApp }, firestore] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ])
  const app = initializeApp({
    credential: cert(serviceAccount ?? { projectId, clientEmail, privateKey }),
    projectId,
  })

  return {
    app,
    db: firestore.getFirestore(app),
    Timestamp: firestore.Timestamp,
    GeoPoint: firestore.GeoPoint,
    FieldValue: firestore.FieldValue,
    projectId,
    collectionName: process.env.FIRESTORE_RULES_COLLECTION?.trim() || 'rules',
  }
}

async function getPublishedDocuments(collection) {
  const snapshot = await collection.where('status', '==', 'published').get()
  return snapshot.docs
}

async function rejectNonPublishedIdCollisions(collection, desiredDocuments) {
  const ids = [...desiredDocuments.keys()]
  for (let start = 0; start < ids.length; start += 400) {
    const refs = ids.slice(start, start + 400).map((id) => collection.doc(id))
    const existing = await collection.firestore.getAll(...refs)
    const collision = existing.find((document) => document.exists && document.data()?.status !== 'published')
    if (collision) {
      throw new Error(`Refusing to overwrite non-published document "${collision.id}".`)
    }
  }
}

async function writeBackup({ docs, dbContext }) {
  const backupPath = path.join(backupDirectory, `published-rules-${timestamp}.json`)
  const backup = {
    version: 1,
    projectId: dbContext.projectId,
    collectionName: dbContext.collectionName,
    createdAt: new Date().toISOString(),
    documents: docs.map((document) => ({
      id: document.id,
      data: serializeFirestoreValue(document.data()),
    })),
  }
  await mkdir(backupDirectory, { recursive: true })
  await writeFile(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { flag: 'wx' })
  return backupPath
}

async function replacePublishedDocuments({ collection, currentDocs, desiredDocuments }) {
  let written = 0
  const records = [...desiredDocuments.entries()]

  for (let start = 0; start < records.length; start += 400) {
    const batch = collection.firestore.batch()
    const chunk = records.slice(start, start + 400)
    for (const [id, data] of chunk) batch.set(collection.doc(id), data)
    await batch.commit()
    written += chunk.length
    console.log(`Wrote ${written}/${records.length} replacement tools.`)
  }

  const desiredIds = new Set(desiredDocuments.keys())
  const staleDocs = currentDocs.filter((document) => !desiredIds.has(document.id))
  let deleted = 0
  for (let start = 0; start < staleDocs.length; start += 400) {
    const batch = collection.firestore.batch()
    const chunk = staleDocs.slice(start, start + 400)
    for (const document of chunk) batch.delete(document.ref)
    await batch.commit()
    deleted += chunk.length
    console.log(`Deleted ${deleted}/${staleDocs.length} old published tools.`)
  }

  return { written, deleted }
}

async function run() {
  const options = parseArguments(args)
  if (options.help) {
    printHelp()
    return
  }
  if (options.apply && !options.confirmProjectId) {
    throw new Error('Applying requires --confirm-replace <firebase-project-id>.')
  }
  if (!options.apply && options.confirmProjectId) {
    throw new Error('--confirm-replace can only be used together with --apply.')
  }
  if (options.restoreBackup && args.includes('--file')) {
    throw new Error('Use either --file or --restore-backup, not both.')
  }
  if (options.restoreBackup && !options.apply) {
    throw new Error('Restoring a backup requires --apply and --confirm-replace <firebase-project-id>.')
  }

  let validation
  let restorePayload
  let inputPath = options.file
  if (options.restoreBackup) {
    inputPath = options.restoreBackup
    restorePayload = JSON.parse(await readFile(options.restoreBackup, 'utf8'))
    validation = {
      rows: Array.isArray(restorePayload.documents) ? restorePayload.documents : [],
      errors: [],
      totalRows: Array.isArray(restorePayload.documents) ? restorePayload.documents.length : 0,
    }
  } else {
    const csv = await readFile(options.file, 'utf8')
    try {
      validation = validateCsv(csv)
    } catch (error) {
      validation = {
        rows: [],
        errors: [{ row: null, message: error.message }],
        totalRows: 0,
      }
    }
  }

  const report = {
    createdAt: new Date().toISOString(),
    mode: options.restoreBackup ? 'restore-backup' : options.apply ? 'replace' : 'dry-run',
    input: inputPath,
    totalRows: validation.totalRows ?? validation.rows.length,
    validRows: validation.rows.length,
    invalidRowCount: new Set(validation.errors.map((error) => error.row).filter(Number.isInteger)).size,
    errorCount: validation.errors.length,
    errors: validation.errors,
    preview: options.restoreBackup ? [] : validation.rows,
    status: 'validated',
  }
  await writeReport(options.report, report)
  console.log(
    `Rows: ${report.totalRows}; valid: ${report.validRows}; invalid: ${report.invalidRowCount}; errors: ${report.errorCount}`,
  )
  console.log(`Report: ${options.report}`)
  for (const error of validation.errors) {
    console.error(`CSV line ${error.row ?? '?'}: ${error.message}`)
  }

  if (validation.errors.length > 0) {
    report.status = 'validation-failed'
    await writeReport(options.report, report)
    process.exitCode = 1
    return
  }
  if (!options.apply) {
    console.log('Dry run only. No Firebase credentials were loaded and no database changes were made.')
    console.log(`To replace published tools, rerun with --apply --confirm-replace <firebase-project-id>.`)
    return
  }

  let dbContext
  try {
    dbContext = await getFirebaseContext(options.confirmProjectId)
    const collection = dbContext.db.collection(dbContext.collectionName)
    let desiredDocuments
    if (options.restoreBackup) {
      validateBackup(restorePayload, dbContext.projectId, dbContext.collectionName)
      desiredDocuments = new Map(
        restorePayload.documents.map((document) => [
          document.id,
          deserializeFirestoreValue(document.data, dbContext),
        ]),
      )
    } else {
      desiredDocuments = new Map(validation.rows.map((row) => [row.slug, {
        ...toPublishedTool(row),
        updatedAt: dbContext.FieldValue.serverTimestamp(),
      }]))
    }

    if (desiredDocuments.size === 0) {
      throw new Error('No tools are available to write; refusing to replace published documents.')
    }

    const currentDocs = await getPublishedDocuments(collection)
    if (currentDocs.length === 0 && !options.restoreBackup) {
      throw new Error('No published documents were found to back up; refusing replacement.')
    }
    await rejectNonPublishedIdCollisions(collection, desiredDocuments)

    const backupPath = await writeBackup({ docs: currentDocs, dbContext })
    report.projectId = dbContext.projectId
    report.collectionName = dbContext.collectionName
    report.backup = backupPath
    report.status = 'backed-up'
    await writeReport(options.report, report)
    console.log(`Backed up ${currentDocs.length} currently published tools to ${backupPath}`)

    const result = await replacePublishedDocuments({ collection, currentDocs, desiredDocuments })
    report.status = 'applied'
    report.written = result.written
    report.deleted = result.deleted
    await writeReport(options.report, report)
    console.log(`Replacement complete: ${result.written} written, ${result.deleted} old published tools deleted.`)
    if (options.restoreBackup) console.log('Backup restore completed.')
  } catch (error) {
    report.status = report.backup ? 'apply-failed' : 'preflight-failed'
    report.operationError = error instanceof Error ? error.message : String(error)
    await writeReport(options.report, report)
    if (report.backup) {
      throw new Error(
        `Replacement failed. Recovery backup remains at ${report.backup}. Some batches may already have committed; inspect Firestore before retrying.`,
        { cause: error },
      )
    }
    throw error
  } finally {
    if (dbContext) await dbContext.app.delete()
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
