'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

async function writeToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Clipboard API can be blocked in iframes; fall through to the legacy path.
    }
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) throw new Error('Copy failed')
}

export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timeout.current), [])

  async function handleCopy() {
    clearTimeout(timeout.current)
    try {
      await writeToClipboard(text)
      setStatus('copied')
    } catch {
      setStatus('error')
    }
    timeout.current = setTimeout(() => setStatus('idle'), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-md border border-border bg-background/80 px-2.5 font-mono text-xs backdrop-blur transition-colors hover:bg-secondary focus-visible:outline-2',
        status === 'copied' && 'border-primary/50 text-primary',
        status === 'error' && 'border-destructive/50 text-destructive',
        className,
      )}
    >
      {status === 'copied' ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      <span>{status === 'copied' ? 'Copied' : status === 'error' ? 'Failed' : 'Copy'}</span>
      <span className="sr-only">{label}</span>
      <span aria-live="polite" className="sr-only">
        {status === 'copied' ? 'Copied to clipboard' : status === 'error' ? 'Copy failed' : ''}
      </span>
    </button>
  )
}
