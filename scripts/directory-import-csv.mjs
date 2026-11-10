export const LIMITS = {
  title: { min: 2, max: 60 },
  description: { min: 3, max: 80 },
}

export function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, '')
  const records = []
  let fields = []
  let field = ''
  let inQuotes = false
  let afterQuote = false
  let line = 1
  let recordLine = 1

  function finishRecord() {
    fields.push(field)
    if (fields.some((value) => value.trim() !== '')) {
      records.push({ line: recordLine, fields })
    }
    fields = []
    field = ''
    afterQuote = false
    recordLine = line + 1
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
          afterQuote = true
        }
      } else if (character === '\r' || character === '\n') {
        if (character === '\r' && source[index + 1] === '\n') index += 1
        field += '\n'
        line += 1
      } else {
        field += character
      }
      continue
    }

    if (afterQuote && character !== ',' && character !== '\r' && character !== '\n') {
      throw new Error(`Unexpected character after a quoted field on CSV line ${line}.`)
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new Error(`Unexpected quote inside an unquoted field on CSV line ${line}.`)
      }
      inQuotes = true
    } else if (character === ',') {
      fields.push(field)
      field = ''
      afterQuote = false
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      finishRecord()
      line += 1
      recordLine = line
    } else {
      field += character
    }
  }

  if (inQuotes) {
    throw new Error(`Unterminated quoted field starting on or before CSV line ${recordLine}.`)
  }

  if (fields.length > 0 || field.length > 0 || afterQuote) {
    finishRecord()
  }

  return records
}

export function normalizeRepository(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return { error: 'Repository must be a valid GitHub repository URL.' }
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== 'github.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return { error: 'Repository must be an https://github.com/owner/repository URL.' }
  }

  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length !== 2 || segments.some((segment) => /[%\\]/.test(segment))) {
    return { error: 'Repository URL must point directly to one GitHub repository.' }
  }

  const [owner, rawRepository] = segments
  const repository = rawRepository.replace(/\.git$/i, '')
  if (
    !/^[A-Za-z0-9-]{1,39}$/.test(owner) ||
    !/^[A-Za-z0-9_.-]+$/.test(repository) ||
    repository === '.' ||
    repository === '..'
  ) {
    return { error: 'Repository URL contains an invalid owner or repository name.' }
  }

  const normalized = `https://github.com/${owner}/${repository}`
  return { url: normalized, key: normalized.toLowerCase() }
}

export function validateCsv(text) {
  const parsed = parseCsv(text)
  const errors = []
  if (parsed.length === 0) {
    return { rows: [], errors: [{ row: 1, message: 'CSV is empty.' }], totalRows: 0 }
  }

  const headerRecord = parsed[0]
  const headers = headerRecord.fields.map((header) => header.trim().toLowerCase())
  const requiredHeaders = ['name', 'description', 'repository']
  if (parsed.length === 1) {
    return {
      rows: [],
      errors: [{ row: headerRecord.line, message: 'CSV has no tool rows.' }],
      totalRows: 0,
    }
  }

  if (
    headers.length !== requiredHeaders.length ||
    requiredHeaders.some((header) => !headers.includes(header)) ||
    new Set(headers).size !== headers.length
  ) {
    return {
      rows: [],
      errors: [{
        row: headerRecord.line,
        message: 'CSV headers must be exactly: name, description, repository (in any order).',
      }],
      totalRows: parsed.length - 1,
    }
  }

  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]))
  const rows = []
  const repositories = new Map()
  const slugs = new Map()

  for (const record of parsed.slice(1)) {
    if (record.fields.length !== headers.length) {
      errors.push({
        row: record.line,
        message: `Expected ${headers.length} columns but found ${record.fields.length}.`,
      })
      continue
    }

    const name = record.fields[indexes.name].trim()
    const description = record.fields[indexes.description].trim()
    const repositoryValue = record.fields[indexes.repository].trim()
    let rowIsValid = true

    if (name.length < LIMITS.title.min || name.length > LIMITS.title.max) {
      errors.push({
        row: record.line,
        message: `Name must be ${LIMITS.title.min}-${LIMITS.title.max} characters.`,
      })
      rowIsValid = false
    }

    if (description.length < LIMITS.description.min || description.length > LIMITS.description.max) {
      errors.push({
        row: record.line,
        message: `Description must be ${LIMITS.description.min}-${LIMITS.description.max} characters.`,
      })
      rowIsValid = false
    }

    if (!name || !description || !repositoryValue) {
      errors.push({
        row: record.line,
        message: 'Name, description, and repository are all required.',
      })
      rowIsValid = false
    }

    const repository = normalizeRepository(repositoryValue)
    if (repository.error) {
      errors.push({ row: record.line, message: repository.error })
      rowIsValid = false
    }

    const slug = slugify(name)
    if (!slug) {
      errors.push({ row: record.line, message: 'Name must contain letters or numbers.' })
      rowIsValid = false
    }

    if (repository.key && repositories.has(repository.key)) {
      errors.push({
        row: record.line,
        message: `Duplicate repository URL; it first appears on CSV line ${repositories.get(repository.key)}.`,
      })
      rowIsValid = false
    } else if (repository.key) {
      repositories.set(repository.key, record.line)
    }

    if (slug && slugs.has(slug)) {
      errors.push({
        row: record.line,
        message: `Name generates duplicate slug "${slug}"; it first appears on CSV line ${slugs.get(slug)}.`,
      })
      rowIsValid = false
    } else if (slug) {
      slugs.set(slug, record.line)
    }

    if (rowIsValid) {
      rows.push({
        line: record.line,
        slug,
        title: name,
        description,
        repository: repository.url,
      })
    }
  }

  return { rows, errors, totalRows: parsed.length - 1 }
}

export function toPublishedTool(row) {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    tags: [],
    author: { name: 'directory' },
    content: row.description,
    url: row.repository,
    upvotes: 0,
    views: 0,
    status: 'published',
    source: 'csv-import',
  }
}
