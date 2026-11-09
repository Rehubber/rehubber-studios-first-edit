import type { SubmissionInput } from './types'

export const LIMITS = {
  title: { min: 2, max: 60 },
  description: { min: 3, max: 80 },
  content: { min: 0, max: 20000 },
  tags: { max: 5, tagMax: 24 },
  authorName: { max: 39 },
} as const

type FieldErrors = Partial<Record<keyof SubmissionInput, string>>

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseSubmission(
  body: unknown,
): { ok: true; data: SubmissionInput } | { ok: false; fieldErrors: FieldErrors } {
  const input = (body ?? {}) as Record<string, unknown>
  const fieldErrors: FieldErrors = {}

  const title = asTrimmedString(input.title)
  const description = asTrimmedString(input.description)
  const content = asTrimmedString(input.content)
  const authorName = asTrimmedString(input.authorName)
  const authorUrl = asTrimmedString(input.authorUrl)
  const rawTags = Array.isArray(input.tags) ? input.tags : []
  const tags = [...new Set(rawTags.map(asTrimmedString).filter(Boolean))]

  if (title.length < LIMITS.title.min || title.length > LIMITS.title.max) {
    fieldErrors.title = `Title must be ${LIMITS.title.min}-${LIMITS.title.max} characters.`
  } else if (!slugify(title)) {
    fieldErrors.title = 'Title must contain letters or numbers.'
  }

  if (description.length < LIMITS.description.min || description.length > LIMITS.description.max) {
    fieldErrors.description = `Description must be ${LIMITS.description.min}-${LIMITS.description.max} characters.`
  }

  if (content && content.length > LIMITS.content.max) {
    fieldErrors.content = `Content must be under ${LIMITS.content.max} characters.`
  }

  if (tags.length > LIMITS.tags.max || tags.some((tag) => tag.length > LIMITS.tags.tagMax)) {
    fieldErrors.tags = `Use up to ${LIMITS.tags.max} tags, ${LIMITS.tags.tagMax} characters each.`
  }

  if (authorName && (authorName.length > LIMITS.authorName.max || /[^a-zA-Z0-9-]/.test(authorName))) {
    fieldErrors.authorName = 'Use a valid GitHub username.'
  }

  if (authorUrl) {
    try {
      const url = new URL(authorUrl)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error()
      if (!url.hostname.includes('github.com') && !url.hostname.includes('gitlab.com')) {
        fieldErrors.authorUrl = 'Repository must be a valid GitHub or GitLab URL.'
      }
    } catch {
      fieldErrors.authorUrl = 'Link must be a valid repository URL.'
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors }

  return { ok: true, data: { title, description, content, tags, authorName, authorUrl } }
}
