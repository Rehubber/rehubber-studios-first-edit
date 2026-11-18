type Fields = Record<string, string | number | boolean | null>

type Document = {
  fields: Fields
  updateTime: string
}

type ServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodedJson(value: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(value)))
}

function serialize(fields: Fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (value === null) return [key, { nullValue: null }]
    if (typeof value === 'string') return [key, { stringValue: value }]
    if (typeof value === 'boolean') return [key, { booleanValue: value }]
    return [key, { integerValue: String(value) }]
  }))
}

function deserialize(fields: Record<string, Record<string, unknown>> = {}): Fields {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if ('stringValue' in value) return [key, String(value.stringValue)]
    if ('integerValue' in value) return [key, Number(value.integerValue)]
    if ('doubleValue' in value) return [key, Number(value.doubleValue)]
    if ('booleanValue' in value) return [key, Boolean(value.booleanValue)]
    if ('nullValue' in value) return [key, null]
    return [key, null]
  }))
}

export class Firestore {
  private account: ServiceAccount
  private token = ''
  private base: string
  private root: string

  constructor(json: string) {
    this.account = JSON.parse(json) as ServiceAccount
    if (!this.account.project_id || !this.account.client_email || !this.account.private_key) {
      throw new Error('Invalid Firebase service account configuration')
    }
    this.root = `projects/${this.account.project_id}/databases/(default)/documents`
    this.base = `https://firestore.googleapis.com/v1/${this.root}`
  }

  private async authorize() {
    if (this.token) return this.token
    const now = Math.floor(Date.now() / 1000)
    const header = encodedJson({ alg: 'RS256', typ: 'JWT' })
    const payload = encodedJson({
      iss: this.account.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
    const pem = this.account.private_key.replace(/-----[^-]+-----|\s/g, '')
    const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
    const key = await crypto.subtle.importKey('pkcs8', keyBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
    const unsigned = `${header}.${payload}`
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${base64url(new Uint8Array(signature))}`,
      }),
    })
    if (!response.ok) throw new Error(`Firebase authorization failed (${response.status})`)
    const data = await response.json() as { access_token?: string }
    if (!data.access_token) throw new Error('Firebase authorization returned no token')
    this.token = data.access_token
    return this.token
  }

  private name(path: string) {
    return `${this.root}/${path}`
  }

  async get(path: string): Promise<Document | null> {
    const response = await fetch(`${this.base}/${path}`, {
      headers: { Authorization: `Bearer ${await this.authorize()}` },
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Firestore read failed (${response.status})`)
    const doc = await response.json() as { fields?: Record<string, Record<string, unknown>>; updateTime: string }
    return { fields: deserialize(doc.fields), updateTime: doc.updateTime }
  }

  async commit(writes: Array<{ path: string; fields?: Fields; previous: Document | null }>): Promise<boolean> {
    const body = {
      writes: writes.map(({ path, fields, previous }) => ({
        ...(fields ? { update: { name: this.name(path), fields: serialize(fields) } } : { verify: this.name(path) }),
        currentDocument: previous ? { updateTime: previous.updateTime } : { exists: false },
      })),
    }
    const response = await fetch(`${this.base}:commit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.authorize()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (response.ok) return true
    const error = await response.json() as { error?: { status?: string } }
    if (['FAILED_PRECONDITION', 'ABORTED', 'ALREADY_EXISTS', 'NOT_FOUND'].includes(error.error?.status || '')) return false
    throw new Error(`Firestore commit failed (${response.status})`)
  }
}
