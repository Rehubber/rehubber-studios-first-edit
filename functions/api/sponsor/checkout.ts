import { json, PRICE_CENTS, PRIVATE_SLOT, PUBLIC_SLOT, services, validSponsor, type Context } from '../../_sponsor/shared'

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  try {
    const { stripe, db, origin } = services(env)
    if (request.headers.get('Origin') !== origin) return json('Request origin not allowed.', 403)
    if (Number(request.headers.get('Content-Length') || 0) > 4096) return json('Request too large.', 413)
    let input: unknown
    try {
      input = await request.json()
    } catch {
      return json('Invalid request.', 400)
    }
    if (!validSponsor(input)) return json('Please check your sponsor information.', 400)

    const reservationId = crypto.randomUUID()
    let reserved = false
    for (let attempt = 0; attempt < 5; attempt++) {
      const [slot, booking] = await Promise.all([db.get(PRIVATE_SLOT), db.get(PUBLIC_SLOT)])
      const now = Date.now()
      if (booking?.fields.status === 'active' && Number(booking.fields.endsAtMs) > now) {
        return json('The sponsorship spot is currently booked.', 409)
      }
      if (slot?.fields.status === 'pending' || (slot?.fields.status === 'active' && Number(slot.fields.endsAtMs) > now)) {
        return json('The sponsorship spot is currently reserved. Please try again later.', 409)
      }
      reserved = await db.commit([
        { path: PRIVATE_SLOT, previous: slot, fields: {
          reservationId, status: 'pending', sponsorName: input.sponsorName,
          sponsorUrl: input.sponsorUrl, email: input.email, createdAtMs: now,
        } },
        { path: PUBLIC_SLOT, previous: booking },
      ])
      if (reserved) break
    }
    if (!reserved) return json('The spot is being reserved. Please try again.', 409)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      allowed_payment_method_types: ['card'],
      adaptive_pricing: { enabled: false },
      customer_email: input.email,
      payment_intent_data: { receipt_email: input.email },
      client_reference_id: reservationId,
      metadata: { reservationId },
      line_items: [{ quantity: 1, price_data: {
        currency: 'usd', unit_amount: PRICE_CENTS,
        product_data: { name: 'Rehubber site ally sponsorship — one week' },
      } }],
      expires_at: Math.floor(Date.now() / 1000) + 45 * 60,
      success_url: `${origin}/partner/book/?checkout=success`,
      cancel_url: `${origin}/partner/book/?checkout=cancelled`,
    }, { idempotencyKey: reservationId })
    if (!session.url) throw new Error('Stripe returned a checkout session without a URL')
    return Response.json({ url: session.url }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Sponsor checkout failed:', error instanceof Error ? error.name : 'Unknown error')
    return json('Checkout is temporarily unavailable. Please contact us before retrying.', 503)
  }
}
