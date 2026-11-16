import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
nextEnv.loadEnvConfig(root)

function clean(value) {
  return value ? String(value).trim().replace(/^['"]+|['"]+$/g, '') : ''
}

function parseCsv(source) {
  const text = source.replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += character
      }
      continue
    }

    if (character === '"' && field.length === 0) {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      row.push(field)
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      field = ''
      if (character === '\r' && text[index + 1] === '\n') index += 1
    } else {
      field += character
    }
  }

  if (quoted) throw new Error('The CSV contains an unterminated quoted field.')
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((value) => value.trim() !== '')) rows.push(row)
  }

  const firstRow = rows[0]?.map((value) => value.trim().toLowerCase())
  if (firstRow?.[0] === 'name' && firstRow[1] === 'description' && firstRow[2] === 'repository') {
    rows.shift()
  }
  return rows
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function normalizeRow(row, rowNumber) {
  if (row.length !== 3) {
    return { error: `row ${rowNumber}: expected 3 columns (name, description, repository), found ${row.length}` }
  }

  const [rawName, rawDescription, rawRepository] = row
  const title = rawName.trim()
  const description = rawDescription.trim()
  const repository = rawRepository.trim()
  const slug = slugify(title)

  if (title.length < 2 || title.length > 120 || !slug) {
    return { error: `row ${rowNumber}: name must be 2-120 characters and produce a valid slug` }
  }
  if (description.length < 3 || description.length > 500) {
    return { error: `row ${rowNumber}: description must be 3-500 characters` }
  }

  let repositoryUrl
  try {
    repositoryUrl = new URL(repository)
  } catch {
    return { error: `row ${rowNumber}: repository must be a valid HTTPS GitHub or GitLab URL` }
  }

  const allowedHosts = new Set(['github.com', 'www.github.com', 'gitlab.com', 'www.gitlab.com'])
  const pathParts = repositoryUrl.pathname.split('/').filter(Boolean)
  if (repositoryUrl.protocol !== 'https:' || !allowedHosts.has(repositoryUrl.hostname) || pathParts.length < 2) {
    return { error: `row ${rowNumber}: repository must be a valid HTTPS GitHub or GitLab URL` }
  }

  const authorName = pathParts[0]
  if (authorName.length > 39 || !/^[A-Za-z0-9-]+$/.test(authorName)) {
    return { error: `row ${rowNumber}: repository owner is not a valid author name` }
  }

  return {
    rule: {
      slug,
      title,
      description,
      content: description,
      tags: ['Developer Tools'],
      author: { name: authorName, url: repository },
      url: repository,
      upvotes: 0,
      views: 0,
      date: new Date().toISOString().slice(0, 10),
      status: 'published',
      source: 'local-seed',
    },
  }
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const inputArgs = args.filter((argument) => !argument.startsWith('--'))
  if (inputArgs.length !== 1 || args.some((argument) => argument.startsWith('--') && argument !== '--apply')) {
    throw new Error('Usage: npm run import:directory -- <csv-path> [--apply]')
  }

  const csvPath = path.resolve(inputArgs[0])
  const rows = parseCsv(await readFile(csvPath, 'utf8'))
  if (rows.length === 0) throw new Error('The CSV contains no tool rows.')

  const errors = []
  const records = []
  for (let index = 0; index < rows.length; index += 1) {
    const result = normalizeRow(rows[index], index + 1)
    if (result.error) errors.push(result.error)
    else records.push(result.rule)
  }

  const slugRows = new Map()
  for (const record of records) {
    const matchingRows = slugRows.get(record.slug) ?? []
    matchingRows.push(record)
    slugRows.set(record.slug, matchingRows)
  }
  const duplicateSlugs = new Set(
    [...slugRows.entries()].filter(([, matchingRows]) => matchingRows.length > 1).map(([slug]) => slug),
  )

  const projectId = clean(process.env.FIREBASE_PROJECT_ID)
  const clientProjectId = clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL)
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/\\n/g, '\n')

  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required.')
  if (clientProjectId && clientProjectId !== projectId) {
    throw new Error('FIREBASE_PROJECT_ID does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID.')
  }

  let credential
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson)
    if (serviceAccount.project_id !== projectId) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON targets a different Firebase project.')
    }
    credential = cert(serviceAccount)
  } else if (clientEmail && privateKey) {
    credential = cert({ projectId, clientEmail, privateKey })
  } else {
    throw new Error('Firebase Admin credentials are required; no records were written.')
  }

  const app = getApps()[0] ?? initializeApp({ credential, projectId })
  const collectionName = process.env.FIRESTORE_RULES_COLLECTION?.trim() || 'rules'
  const collection = getFirestore(app).collection(collectionName)
  const snapshot = await collection.get()
  const existingSlugs = new Set()
  for (const document of snapshot.docs) {
    existingSlugs.add(document.id)
    const storedSlug = document.get('slug')
    if (typeof storedSlug === 'string') existingSlugs.add(storedSlug)
  }

  const uniqueRecords = records.filter((record) => !duplicateSlugs.has(record.slug))
  const conflicts = uniqueRecords.filter((record) => existingSlugs.has(record.slug))
  const newRecords = uniqueRecords.filter((record) => !existingSlugs.has(record.slug))
  const duplicateRowCount = records.filter((record) => duplicateSlugs.has(record.slug)).length

  console.log(`Target: ${projectId}/${collectionName}`)
  console.log(`CSV rows: ${rows.length}; valid rows: ${records.length}; invalid rows: ${errors.length}`)
  console.log(`Duplicate rows in CSV: ${duplicateRowCount}; existing slugs skipped: ${conflicts.length}; new tools: ${newRecords.length}`)
  for (const error of errors) console.error(`Invalid: ${error}`)
  for (const record of conflicts) console.log(`Skipped existing slug: ${record.slug}`)
  for (const slug of duplicateSlugs) console.log(`Skipped duplicate CSV slug: ${slug}`)

  if (errors.length > 0) {
    process.exitCode = 1
    if (apply) console.error('No records were written because the CSV has invalid rows.')
    return
  }

  if (!apply) {
    console.log('Dry run only; no records were written. Add --apply after reviewing this report.')
    return
  }

  let imported = 0
  for (let offset = 0; offset < newRecords.length; offset += 400) {
    const batch = getFirestore(app).batch()
    const chunk = newRecords.slice(offset, offset + 400)
    for (const record of chunk) {
      batch.create(collection.doc(record.slug), {
        ...record,
        syncedAt: FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()
    imported += chunk.length
    console.log(`Created ${imported} of ${newRecords.length} new tools.`)
  }

  console.log(`Import complete: created ${imported}; existing records were not modified.`)
}

await main()
