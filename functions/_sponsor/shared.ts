import Stripe from 'stripe'
import { Firestore } from './firestore'

export type Env = {
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  FIREBASE_SERVICE_ACCOUNT_JSON: string
  SPONSOR_SITE_ORIGIN: string
}

export type Context = { request: Request; env: Env }

export const PRIVATE_SLOT = 'sponsor_checkout/current'
export const PUBLIC_SLOT = 'sponsor_bookings/current'
export const PRICE_CENTS = 29900
export const WEEK_MS = 604800000

export function services(env: Env) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.FIREBASE_SERVICE_ACCOUNT_JSON || !env.SPONSOR_SITE_ORIGIN) {
    throw new Error('Sponsor checkout is not configured')
  }
  if (!/^(sk|rk)_(test|live)_/.test(env.STRIPE_SECRET_KEY)) throw new Error('Invalid Stripe secret key')
  const origin = new URL(env.SPONSOR_SITE_ORIGIN)
  if (origin.origin !== env.SPONSOR_SITE_ORIGIN || (origin.protocol !== 'https:' && origin.hostname !== 'localhost')) {
    throw new Error('Invalid sponsor site origin')
  }
  return {
    stripe: new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() }),
    db: new Firestore(env.FIREBASE_SERVICE_ACCOUNT_JSON),
    origin: origin.origin,
  }
}

export function validSponsor(input: unknown): input is { sponsorName: string; sponsorUrl: string; email: string } {
  if (!input || typeof input !== 'object') return false
  const data = input as Record<string, unknown>
  if (typeof data.sponsorName !== 'string' || typeof data.sponsorUrl !== 'string' || typeof data.email !== 'string') return false
  if (data.sponsorName !== data.sponsorName.trim() || data.sponsorName.length < 2 || data.sponsorName.length > 32) return false
  if (data.sponsorUrl !== data.sponsorUrl.trim() || data.sponsorUrl.length > 300) return false
  if (data.email !== data.email.trim() || data.email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return false
  try {
    const url = new URL(data.sponsorUrl)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

export function json(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}
