import Stripe from 'stripe'
import { json, PRICE_CENTS, PRIVATE_SLOT, PUBLIC_SLOT, services, WEEK_MS, type Context } from '../../_sponsor/shared'

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) return json('Webhook is not configured.', 503)
  let event: Stripe.Event
  let dependencies: ReturnType<typeof services>
  try {
    dependencies = services(env)
    const signature = request.headers.get('stripe-signature')
    if (!signature) return json('Missing signature.', 400)
    event = await dependencies.stripe.webhooks.constructEventAsync(
      await request.text(), signature, env.STRIPE_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider(),
    )
  } catch {
    console.error('Sponsor webhook verification failed')
    return json('Webhook verification failed.', 400)
  }

  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type)) {
    return new Response(null, { status: 200 })
  }

  try {
    const session = event.data.object as Stripe.Checkout.Session
    const reservationId = session.metadata?.reservationId
    const live = /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY)
    if (event.livemode !== live || session.livemode !== live || !/^cs_(test|live)_[a-zA-Z0-9]+$/.test(session.id)) {
      throw new Error('Unexpected Stripe environment or session ID')
    }
    if (!reservationId || reservationId !== session.client_reference_id) throw new Error('Invalid reservation metadata')
    const paid = session.payment_status === 'paid' &&
      (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded')
    const ended = event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed'
    if (!paid && !ended) return new Response(null, { status: 200 })
    if (paid && (session.mode !== 'payment' || session.currency !== 'usd' || session.amount_total !== PRICE_CENTS)) {
      throw new Error('Unexpected sponsor payment amount or currency')
    }

    const db = dependencies.db
    const paymentPath = `sponsor_payments/${session.id}`
    for (let attempt = 0; attempt < 5; attempt++) {
      const [slot, payment, booking] = await Promise.all([db.get(PRIVATE_SLOT), db.get(paymentPath), db.get(PUBLIC_SLOT)])
      if (payment) return new Response(null, { status: 200 })
      if (!slot || slot.fields.reservationId !== reservationId || slot.fields.status !== 'pending') {
        if (ended) return new Response(null, { status: 200 })
        throw new Error('Paid session does not match the reserved slot')
      }
      if (paid && booking?.fields.status === 'active' && Number(booking.fields.endsAtMs) > Date.now()) {
        throw new Error('Paid session conflicts with an active sponsorship')
      }
      const now = Date.now()
      const writes: Parameters<typeof db.commit>[0] = paid ? [
        { path: PRIVATE_SLOT, previous: slot, fields: { ...slot.fields, status: 'active', endsAtMs: now + WEEK_MS, sessionId: session.id } },
        { path: PUBLIC_SLOT, previous: booking, fields: {
          weekId: 'current', weekStart: new Date(now).toISOString(), weekEnd: new Date(now + WEEK_MS).toISOString(),
          startsAtMs: now, endsAtMs: now + WEEK_MS, sponsorName: slot.fields.sponsorName,
          sponsorUrl: slot.fields.sponsorUrl, amountUsd: PRICE_CENTS / 100, status: 'active',
        } },
        { path: paymentPath, previous: null, fields: {
          reservationId, sessionId: session.id, paidAtMs: now, email: slot.fields.email,
          sponsorName: slot.fields.sponsorName, sponsorUrl: slot.fields.sponsorUrl,
        } },
      ] : [
        { path: PRIVATE_SLOT, previous: slot, fields: { ...slot.fields, status: 'expired', sessionId: session.id } },
      ]
      if (await db.commit(writes)) return new Response(null, { status: 200 })
    }
    throw new Error('Sponsor webhook could not commit after retries')
  } catch (error) {
    console.error('Sponsor webhook processing failed', error)
    return json('Webhook processing failed.', 500)
  }
}
