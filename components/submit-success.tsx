'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ExternalLink, LoaderCircle, Mail, Sparkles } from 'lucide-react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { getFirebaseClientFirestore, isFirebaseConfigured } from '@/lib/firebase-client'
import type { SubmitResponse } from '@/lib/types'

type Success = Extract<SubmitResponse, { ok: true }>

type FlowStep = 'notify' | 'social' | 'submitted'

export function SubmitSuccess({
  result,
  initialEmail = '',
  initialStep = 'notify',
  onReset,
  onStepChange,
}: {
  result: Success
  initialEmail?: string
  initialStep?: FlowStep
  onReset: () => void
  onStepChange?: (step: FlowStep) => void
}) {
  const [step, setStep] = useState<FlowStep>(initialStep)
  const [email, setEmail] = useState(initialEmail)
  const [isBetaUser, setIsBetaUser] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleNotificationSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()

    if (trimmedEmail && !trimmedEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address (e.g. you@gmail.com).')
      return
    }

    if (!trimmedEmail) {
      // User didn't type an email, simply proceed to social step
      changeStep('social')
      return
    }

    setSaving(true)
    setErrorMessage(null)

    try {
      if (isFirebaseConfigured()) {
        try {
          const db = getFirebaseClientFirestore()
          await addDoc(collection(db, 'subscribers'), {
            email: trimmedEmail,
            submissionId: result.submissionId,
            isBetaCommunity: isBetaUser,
            category: isBetaUser ? 'beta_user_community' : 'submission_status_updates',
            status: 'active',
            source: 'tool_submission_flow',
            createdAt: serverTimestamp(),
          })
        } catch (dbError) {
          console.warn('Firestore subscription write fallback:', dbError)
        }
      }

      // Local storage fallback so categorized beta users are stored
      try {
        const stored = window.localStorage.getItem('rehubber:beta_subscribers')
        const list = stored ? JSON.parse(stored) : []
        list.push({
          email: trimmedEmail,
          submissionId: result.submissionId,
          isBetaCommunity: isBetaUser,
          category: isBetaUser ? 'beta_user_community' : 'submission_status_updates',
          savedAt: new Date().toISOString(),
        })
        window.localStorage.setItem('rehubber:beta_subscribers', JSON.stringify(list))
      } catch {
        // Ignore localStorage error
      }

      changeStep('social')
    } catch {
      // Non-blocking, continue to social step
      changeStep('social')
    } finally {
      setSaving(false)
    }
  }

  function changeStep(nextStep: FlowStep) {
    setStep(nextStep)
    onStepChange?.(nextStep)
  }

  return (
    <section aria-live="polite" className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
      {/* Top flow preview switcher bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
          <span>Tool submitted for review (ID: {result.submissionId.slice(0, 14)})</span>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-secondary/40 p-1 text-xs">
          <button
            type="button"
            onClick={onReset}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors cursor-pointer"
            title="Return to the submission form"
          >
            ← Form
          </button>
          <button
            type="button"
            onClick={() => changeStep('notify')}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
              step === 'notify'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
            }`}
          >
            1. Email
          </button>
          <button
            type="button"
            onClick={() => changeStep('social')}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
              step === 'social'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
            }`}
          >
            2. Follow on X
          </button>
          <button
            type="button"
            onClick={() => changeStep('submitted')}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
              step === 'submitted'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
            }`}
          >
            3. Submitted
          </button>
        </div>
      </div>

      {step === 'notify' && (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Get notified directly once your tool is live, approved and listed on Rehubber.
          </p>

          <form onSubmit={handleNotificationSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="notify-email" className="text-xs font-medium text-foreground">
                  Email address <span className="text-muted-foreground font-normal">optional</span>
                </label>
                <span className="text-[10.5px] text-muted-foreground">Personal or work (e.g. Gmail)</span>
              </div>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
                <input
                  id="notify-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  placeholder="you@gmail.com"
                  className="h-10 w-full rounded-lg border border-input bg-secondary/40 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
            </div>

            {/* Optional beta user community check box */}
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors select-none pt-1">
              <input
                type="checkbox"
                checked={isBetaUser}
                onChange={(e) => setIsBetaUser(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border bg-secondary text-primary accent-primary cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <span>become part of our beta user community</span>
                {isBetaUser && <Sparkles className="size-3 text-primary shrink-0" aria-hidden="true" />}
              </span>
            </label>

            {/* Underneath: Skip button (Next button removed) */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/70">
              <button
                type="button"
                onClick={() => handleNotificationSubmit()}
                disabled={saving}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              >
                {saving && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}
                <span>{email.trim() ? (saving ? 'Saving…' : 'Skip') : 'Skip'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 'social' && (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Follow us on X to get updates and major announcements
          </p>

          <div className="flex flex-col items-start gap-4 py-2">
            <a
              href="https://x.com/odysseus"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2.5 rounded-xl bg-foreground px-6 text-xs sm:text-sm font-semibold text-background shadow-md transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              <svg className="size-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>Follow us on X (@odysseus)</span>
              <ExternalLink className="size-3.5 opacity-60" aria-hidden="true" />
            </a>
          </div>

          {/* Finish button underneath (Back to directory and Submit another tool removed) */}
          <div className="flex items-center justify-start gap-3 pt-4 border-t border-border/70">
            <button
              type="button"
              onClick={() => changeStep('submitted')}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 cursor-pointer"
            >
              Finish
            </button>
          </div>
        </div>
      )}

      {step === 'submitted' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="size-6 text-emerald-400" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
                Submitted
              </h2>
              <p className="text-xs text-muted-foreground">
                Your tool has been received and queued for review.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-secondary/30 p-4 text-xs flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Status</span>
              <span className="font-mono font-medium text-emerald-400 uppercase tracking-wider text-[11px]">
                Pending Moderation
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Submission ID</span>
              <span className="font-mono text-foreground text-[11px]">
                {result.submissionId}
              </span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            We review every repository to ensure it meets our open source criteria. You will be notified as soon as your listing is approved if you provided your email.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border/70">
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Back to directory
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
