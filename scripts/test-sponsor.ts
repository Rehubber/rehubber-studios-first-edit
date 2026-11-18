import assert from 'node:assert/strict'
import Stripe from 'stripe'
import { Firestore } from '../functions/_sponsor/firestore'
import { onRequestPost as checkout } from '../functions/api/sponsor/checkout'
import { onRequestPost as webhook } from '../functions/api/sponsor/webhook'
import type { Context } from '../functions/_sponsor/shared'

type Fields = Record<string, string | number | boolean | null>
type Stored = { fields: Fields; updateTime: string }
const documents = new Map<string, Stored>()
let version = 0
let reservationId = ''
let stripeCalls = 0
let failStripe = false
const originalGet = Firestore.prototype.get
const originalCommit = Firestore.prototype.commit
const originalFetch = globalThis.fetch

Firestore.prototype.get = async function (path) {
  const document = documents.get(path)
  return document ? { fields: { ...document.fields }, updateTime: document.updateTime } : null
}
Firestore.prototype.commit = async function (writes) {
  for (const write of writes) {
    const current = documents.get(write.path)
    if (write.previous ? current?.updateTime !== write.previous.updateTime : Boolean(current)) return false
  }
  for (const write of writes) {
    if (write.fields) documents.set(write.path, { fields: { ...write.fields }, updateTime: String(++version) })
  }
  return true
}
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions')
  const body = new URLSearchParams(String(init?.body))
  assert.equal(body.get('line_items[0][price_data][unit_amount]'), '29900')
  assert.equal(body.get('line_items[0][price_data][currency]'), 'usd')
  assert.equal(body.get('allowed_payment_method_types[0]'), 'card')
  reservationId = body.get('client_reference_id') || ''
  stripeCalls++
  if (failStripe) return Response.json({ error: { type: 'invalid_request_error', message: 'test failure' } }, { status: 400 })
  return Response.json({ id: `cs_test_${stripeCalls}`, url: 'https://checkout.stripe.com/c/pay/test' })
}

const env: Context['env'] = {
  STRIPE_SECRET_KEY: 'sk_test_fake',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'test', client_email: 'test', private_key: 'test' }),
  SPONSOR_SITE_ORIGIN: 'https://example.com',
}
const sponsor = { sponsorName: 'Example', sponsorUrl: 'https://example.org', email: 'test@example.org' }

function checkoutRequest(data: unknown = sponsor) {
  return new Request('https://example.com/api/sponsor/checkout', {
    method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

async function webhookRequest(type: string, id: string, status = 'paid', signatureOverride?: string, amount = 29900) {
  const payload = JSON.stringify({
    id: 'evt_test', object: 'event', type, livemode: false,
    data: { object: {
      id, object: 'checkout.session', client_reference_id: reservationId,
      metadata: { reservationId }, mode: 'payment', currency: 'usd', amount_total: amount, payment_status: status, livemode: false,
    } },
  })
  const stripe = new Stripe(env.STRIPE_SECRET_KEY)
  const signature = signatureOverride || await stripe.webhooks.generateTestHeaderStringAsync({
    payload, secret: env.STRIPE_WEBHOOK_SECRET,
  })
  return new Request('https://example.com/api/sponsor/webhook', {
    method: 'POST', headers: { 'stripe-signature': signature }, body: payload,
  })
}

async function run() {
  const invalid = await checkout({ request: checkoutRequest({ ...sponsor, sponsorUrl: 'http://example.org' }), env })
  assert.equal(invalid.status, 400)
  assert.equal(documents.size, 0)

  const attempts = await Promise.all([
    checkout({ request: checkoutRequest(), env }),
    checkout({ request: checkoutRequest(), env }),
  ])
  assert.deepEqual(attempts.map((response) => response.status).sort(), [200, 409])
  assert.equal(stripeCalls, 1)
  assert.equal(documents.get('sponsor_checkout/current')?.fields.status, 'pending')
  assert.equal(documents.has('sponsor_bookings/current'), false)

  const invalidSignature = await webhook({ request: await webhookRequest('checkout.session.completed', 'cs_test_1', 'paid', 't=1,v1=bad'), env })
  assert.equal(invalidSignature.status, 400)
  assert.equal(documents.has('sponsor_bookings/current'), false)

  const unpaid = await webhook({ request: await webhookRequest('checkout.session.completed', 'cs_test_1', 'unpaid'), env })
  assert.equal(unpaid.status, 200)
  assert.equal(documents.has('sponsor_bookings/current'), false)

  const wrongAmount = await webhook({ request: await webhookRequest('checkout.session.completed', 'cs_test_1', 'paid', undefined, 1), env })
  assert.equal(wrongAmount.status, 500)
  assert.equal(documents.has('sponsor_bookings/current'), false)

  const paidRequest = await webhookRequest('checkout.session.completed', 'cs_test_1')
  const duplicateRequest = paidRequest.clone()
  assert.equal((await webhook({ request: paidRequest, env })).status, 200)
  const booking = documents.get('sponsor_bookings/current')?.fields
  assert.equal(booking?.sponsorName, sponsor.sponsorName)
  assert.equal(Number(booking?.endsAtMs) - Number(booking?.startsAtMs), 604800000)
  assert.equal((await webhook({ request: duplicateRequest, env })).status, 200)
  assert.equal(documents.get('sponsor_bookings/current')?.fields.startsAtMs, booking?.startsAtMs)
  assert.equal((await checkout({ request: checkoutRequest(), env })).status, 409)

  documents.clear()
  assert.equal((await checkout({ request: checkoutRequest(), env })).status, 200)
  assert.equal((await webhook({ request: await webhookRequest('checkout.session.expired', 'cs_test_2', 'unpaid'), env })).status, 200)
  assert.equal(documents.get('sponsor_checkout/current')?.fields.status, 'expired')
  assert.equal((await checkout({ request: checkoutRequest(), env })).status, 200)

  documents.clear()
  failStripe = true
  assert.equal((await checkout({ request: checkoutRequest(), env })).status, 503)
  assert.equal(documents.get('sponsor_checkout/current')?.fields.status, 'pending')
  assert.equal((await checkout({ request: checkoutRequest(), env })).status, 409)

  Firestore.prototype.get = originalGet
  Firestore.prototype.commit = originalCommit
  const keys = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  )
  const keyBytes = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keys.privateKey))
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...keyBytes))}\n-----END PRIVATE KEY-----`
  let commits = 0
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url === 'https://oauth2.googleapis.com/token') {
      assert.match(String(init?.body), /grant_type=/)
      return Response.json({ access_token: 'test-token' })
    }
    assert.match(url, /^https:\/\/firestore\.googleapis\.com\/v1\/projects\/test\/databases\/\(default\)\/documents/)
    if (url.endsWith(':commit')) {
      const body = JSON.parse(String(init?.body))
      assert.equal(body.writes[0].currentDocument.updateTime, '2026-01-01T00:00:00Z')
      assert.equal(body.writes[0].update.fields.endsAtMs.integerValue, '1234')
      commits++
      return commits === 1
        ? Response.json({ error: { status: 'FAILED_PRECONDITION' } }, { status: 400 })
        : Response.json({ writeResults: [] })
    }
    return Response.json({ fields: { status: { stringValue: 'pending' }, endsAtMs: { integerValue: '1234' } }, updateTime: '2026-01-01T00:00:00Z' })
  }
  const firestore = new Firestore(JSON.stringify({ project_id: 'test', client_email: 'test@example.org', private_key: pem }))
  const previous = await firestore.get('sponsor_checkout/current')
  assert.equal(previous?.fields.endsAtMs, 1234)
  const write = [{ path: 'sponsor_checkout/current', previous, fields: { endsAtMs: 1234 } }]
  assert.equal(await firestore.commit(write), false)
  assert.equal(await firestore.commit(write), true)
  console.log('Sponsor checkout tests passed')
}

run().finally(() => {
  Firestore.prototype.get = originalGet
  Firestore.prototype.commit = originalCommit
  globalThis.fetch = originalFetch
}).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
