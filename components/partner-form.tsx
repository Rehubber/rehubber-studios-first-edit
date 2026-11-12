'use client'

import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { Check, CircleAlert, Handshake, Mail, Send } from 'lucide-react'
import { getFirebaseClientFirestore } from '@/lib/firebase-client'
import posthog from 'posthog-js'

const PARTNERSHIP_TYPES = [
  'Featured Tool Sponsorship',
  'Directory Partnership',
  'Developer Tool Integration',
  'Newsletter & Co-Marketing',
  'Other / Custom Inquiry',
] as const

type PartnershipType = (typeof PARTNERSHIP_TYPES)[number]

const inputClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-[invalid=true]:border-destructive/60'

export function PartnerForm() {
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [type, setType] = useState<PartnershipType>('Featured Tool Sponsorship')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const trimmedCompany = companyName.trim()
    const trimmedContact = contactName.trim()
    const trimmedEmail = email.trim()
    const trimmedWebsite = website.trim()
    const trimmedMessage = message.trim()

    if (trimmedContact.length < 2) {
      setError('Please provide your name (at least 2 characters).')
      return
    }

    if (!trimmedEmail.includes('@') || trimmedEmail.length < 5) {
      setError('Please enter a valid work email address.')
      return
    }

    if (trimmedMessage.length < 10) {
      setError('Please provide details about your proposal (at least 10 characters).')
      return
    }

    setPending(true)
    setError(null)

    try {
      const db = getFirebaseClientFirestore()
      await addDoc(collection(db, 'support_messages'), {
        name: trimmedContact,
        email: trimmedEmail,
        category: 'Partnership',
        message: `Company: ${trimmedCompany || 'N/A'}\nWebsite: ${trimmedWebsite || 'N/A'}\nType: ${type}\n\n${trimmedMessage}`,
        createdAt: serverTimestamp(),
      })
      posthog.capture('partnership_inquiry_submitted', {
        partnership_type: type,
      })
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.warn('Firestore submission failed, offering mailto fallback:', err)
      setError(
        'Could not save your partnership inquiry automatically. You can also email our partnerships team directly at support@rehubber.com',
      )
    } finally {
      setPending(false)
    }
  }

  function handleReset() {
    setCompanyName('')
    setContactName('')
    setEmail('')
    setWebsite('')
    setType('Featured Tool Sponsorship')
    setMessage('')
    setError(null)
    setSubmitted(false)
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-6 rounded-xl border border-primary/30 bg-primary/5 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Check className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Partnership Proposal Received</h2>
            <p className="text-xs text-muted-foreground">
              Thank you, {contactName}. We have received your inquiry for &quot;{type}&quot;.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/60 p-4 text-xs text-muted-foreground">
          <p className="leading-relaxed">
            Our partnerships team will review your proposal and reply back to{' '}
            <span className="font-mono font-medium text-foreground">{email}</span> within 24–48 hours.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-border bg-secondary/80 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary cursor-pointer"
          >
            Submit another inquiry
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive-foreground"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <span>{error}</span>
            {error.includes('support@rehubber.com') && (
              <a
                href={`mailto:support@rehubber.com?subject=${encodeURIComponent(
                  `[Partnership - ${type}] From ${contactName} (${companyName})`,
                )}&body=${encodeURIComponent(message)}`}
                className="underline underline-offset-2 hover:text-primary"
              >
                Click here to email directly
              </a>
            )}
          </div>
        </div>
      )}

      {/* Contact Name and Work Email */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="partner-name" className="text-xs font-medium text-foreground">
            Contact Name <span className="text-destructive">*</span>
          </label>
          <input
            id="partner-name"
            type="text"
            required
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Jane Doe"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="partner-email" className="text-xs font-medium text-foreground">
            Work Email <span className="text-destructive">*</span>
          </label>
          <input
            id="partner-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
            className={inputClass}
          />
        </div>
      </div>

      {/* Company/Tool Name and Website/GitHub */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="partner-company" className="text-xs font-medium text-foreground">
            Company or Tool Name
          </label>
          <input
            id="partner-company"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Tools"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="partner-website" className="text-xs font-medium text-foreground">
            Website or GitHub URL
          </label>
          <input
            id="partner-website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://acme.dev"
            className={inputClass}
          />
        </div>
      </div>

      {/* Partnership Type selector */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="partner-type" className="text-xs font-medium text-foreground">
          Partnership Interest <span className="text-destructive">*</span>
        </label>
        <select
          id="partner-type"
          value={type}
          onChange={(e) => setType(e.target.value as PartnershipType)}
          className={inputClass}
        >
          {PARTNERSHIP_TYPES.map((t) => (
            <option key={t} value={t} className="bg-card text-foreground">
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Message / Proposal textarea */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="partner-message" className="font-medium text-foreground">
            Proposal Details <span className="text-destructive">*</span>
          </label>
          <span className="font-mono text-[11px] text-muted-foreground/70">
            {message.length}/3000
          </span>
        </div>
        <textarea
          id="partner-message"
          required
          rows={5}
          maxLength={3000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us about your project, tool, integration idea, or sponsorship goals..."
          className={`${inputClass} resize-y font-sans`}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mail className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
          <span>Direct inquiries: <strong className="font-mono text-foreground/90">support@rehubber.com</strong></span>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
        >
          {pending ? (
            <span>Sending...</span>
          ) : (
            <>
              <span>Submit Proposal</span>
              <Send className="size-3.5" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}
