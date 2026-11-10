import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseCsv,
  slugify,
  toPublishedTool,
  validateCsv,
} from './directory-import-csv.mjs'

test('parses BOM, CRLF, escaped quotes, and quoted newlines', () => {
  const records = parseCsv('\uFEFFname,description,repository\r\n"Tool ""A""","first line\r\nsecond line",https://github.com/acme/tool\r\n')
  assert.equal(records.length, 2)
  assert.deepEqual(records[1], {
    line: 2,
    fields: ['Tool "A"', 'first line\nsecond line', 'https://github.com/acme/tool'],
  })
})

test('reports malformed CSV quotes', () => {
  assert.throws(() => parseCsv('name,description,repository\n"unfinished,description,repo'), /Unterminated quoted field/)
  assert.throws(() => parseCsv('name,description,repository\nbad"quote,description,repo'), /Unexpected quote/)
})

test('validates a valid GitHub tools CSV and maps rows to published documents', () => {
  const result = validateCsv([
    'repository,name,description',
    'https://github.com/Acme/Tool.git/,Tool Name,A short useful description.',
  ].join('\n'))

  assert.deepEqual(result.errors, [])
  assert.equal(result.totalRows, 1)
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].slug, 'tool-name')
  assert.equal(result.rows[0].repository, 'https://github.com/Acme/Tool')
  assert.deepEqual(toPublishedTool(result.rows[0]), {
    slug: 'tool-name',
    title: 'Tool Name',
    description: 'A short useful description.',
    tags: [],
    author: { name: 'directory' },
    content: 'A short useful description.',
    url: 'https://github.com/Acme/Tool',
    upvotes: 0,
    views: 0,
    status: 'published',
    source: 'csv-import',
  })
})

test('rejects duplicate repository URLs and generated slugs', () => {
  const result = validateCsv([
    'name,description,repository',
    'Tool One,A short useful description.,https://github.com/acme/tool',
    'Tool-One,Another useful description.,https://github.com/other/project',
    'Tool Three,Third useful description.,https://github.com/ACME/tool.git/',
  ].join('\n'))

  assert.equal(result.rows.length, 1)
  assert.equal(result.totalRows, 3)
  assert.equal(result.errors.length, 2)
  assert.match(result.errors[0].message, /duplicate slug/)
  assert.match(result.errors[1].message, /Duplicate repository URL/)
})

test('rejects invalid headers, row widths, descriptions, names, and non-GitHub URLs', () => {
  const invalidHeaders = validateCsv('name,description,url\nTool,A short useful description.,https://github.com/acme/tool')
  assert.match(invalidHeaders.errors[0].message, /headers must be exactly/)

  const invalidRows = validateCsv([
    'name,description,repository',
    'A,A,https://example.com/acme/tool',
    'This title is definitely much longer than sixty characters total,Description long enough,https://github.com/acme/long',
    'Tool,Description long enough,https://github.com/acme/tool,unexpected',
  ].join('\n'))

  assert.equal(invalidRows.rows.length, 0)
  assert.equal(invalidRows.totalRows, 3)
  assert.ok(invalidRows.errors.some((error) => /Name must be/.test(error.message)))
  assert.ok(invalidRows.errors.some((error) => /Description must be/.test(error.message)))
  assert.ok(invalidRows.errors.some((error) => /https:\/\/github.com/.test(error.message)))
  assert.ok(invalidRows.errors.some((error) => /Expected 3 columns/.test(error.message)))
})

test('uses the directory slug rules', () => {
  assert.equal(slugify('Next.js 15+ Framework!'), 'next-js-15-framework')
  assert.equal(slugify('ＡＣＥ Step'), 'ace-step')
})
