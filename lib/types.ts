export type Rule = {
  slug: string
  title: string
  description?: string
  tags: string[]
  author?: { name: string; url?: string }
  content?: string
  upvotes?: number
  views?: number
  date?: string
  url?: string
  showShare?: boolean
}

export type DirectoryPage = {
  rules: Rule[]
  page: number
  hasMore: boolean
}

export type SubmissionInput = {
  title: string
  description: string
  content: string
  tags: string[]
  authorName: string
  authorUrl: string
}

export type PendingSubmission = {
  id: string
  title: string
  description: string
  content: string
  tags: string[]
  authorName: string
  authorUrl: string
  createdAt: string | null
}

export type SubmitResponse = {
  ok: true
  submissionId: string
  status: 'pending'
}
