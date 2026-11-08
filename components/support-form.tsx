'use client'

import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { Check, CircleAlert, Mail, Send, Sparkles } from 'lucide-react'
import { getFirebaseClientFirestore } from '@/lib/firebase-client'

const CATEGORIES = [
  'General Question',
  'Feature Request',
  'Bug Report',
  'Tool Claim',
  'Partnership',
] as const

type Category = (typeof CATEGORIES)[number]

const inputClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-[invalid=true]:border-destructive/60'

export function SupportForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState<Category>('General Question')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedMessage = message.trim()

    if (trimmedName.length < 2) {
      setError('Please provide your name (at least 2 characters).')
      return
    }

    if (!trimmedEmail.includes('@') || trimmedEmail.length < 5) {
      setError('Please enter a valid email address.')
      return
    }

    if (trimmedMessage.length < 10) {
      setError('Please provide a message with at least 10 characters.')
      return
    }

    setPending(true)
    setError(null)

    try {
      const db = getFirebaseClientFirestore()
      await addDoc(collection(db, 'support_messages'), {
        name: trimmedName,
        email: trimmedEmail,
        category,
        message: trimmedMessage,
        createdAt: serverTimestamp(),
      })
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.warn('Firestore submission failed, offering mailto fallback:', err)
      setError(
        'Could not save your request automatically. You can also email us directly at support@rehubber.com',
      )
    } finally {
      setPending(false)
    }
  }

  function handleReset() {
    setName('')
    setEmail('')
    setCategory('General Question')
    setMessage('')
    setError(null)
    setSubmitted(false)
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <Check className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Message Received</h2>
            <p className="text-xs text-muted-foreground">
              Thank you, {name}. Our team has received your message regarding &quot;{category}&quot;.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/60 p-4 text-xs text-muted-foreground">
          <p className="leading-relaxed">
            We review all inquiries promptly and will reply directly to{' '}
            <span className="font-mono font-medium text-foreground">{email}</span>.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-border bg-secondary/80 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Send another message
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
                  `[${category}] From ${name || 'User'}`,
                )}&body=${encodeURIComponent(message)}`}
                className="underline underline-offset-2 hover:text-primary"
              >
                Click here to send via your email client
              </a>
            )}
          </div>
        </div>
      )}

      {/* Name and Email side by side on desktop */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="support-name" className="text-xs font-medium text-foreground">
            Name <span className="text-destructive">*</span>
          </label>
          <input
            id="support-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="support-email" className="text-xs font-medium text-foreground">
            Email address <span className="text-destructive">*</span>
          </label>
          <input
            id="support-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ada@example.com"
            className={inputClass}
          />
        </div>
      </div>

      {/* Category selector */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="support-category" className="text-xs font-medium text-foreground">
          Subject / Category <span className="text-destructive">*</span>
        </label>
        <select
          id="support-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className={inputClass}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat} className="bg-card text-foreground">
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Message textarea */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="support-message" className="font-medium text-foreground">
            Message <span className="text-destructive">*</span>
          </label>
          <span className="font-mono text-[11px] text-muted-foreground/70">
            {message.length}/2000
          </span>
        </div>
        <textarea
          id="support-message"
          required
          rows={5}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your inquiry, bug report, or tool claim in detail..."
          className={`${inputClass} resize-y font-sans`}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mail className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
          <span>Or write directly to <strong className="font-mono text-foreground/90">support@rehubber.com</strong></span>
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
              <span>Send Message</span>
              <Send className="size-3.5" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}
