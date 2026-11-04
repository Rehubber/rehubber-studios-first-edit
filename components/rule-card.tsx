import { CopyButton } from '@/components/copy-button'
import { UpvoteButton } from '@/components/upvote-button'
import type { Rule } from '@/lib/types'

const PREVIEW_LINES = 9

export function RuleCard({
  rule,
  density = 'compact',
}: {
  rule: Rule
  density?: 'spacious' | 'balanced' | 'compact'
}) {
  const previewLines = density === 'compact' ? 6 : density === 'spacious' ? 10 : 9
  const lines = rule.content.split('\n')
  const preview = lines.slice(0, previewLines)
  const hiddenCount = Math.max(0, lines.length - previewLines)

  const bodyPadding =
    density === 'spacious' ? 'p-6 sm:p-7 gap-4' : density === 'compact' ? 'p-4 gap-2.5' : 'p-5 sm:p-6 gap-3.5'

  const headerPadding =
    density === 'spacious'
      ? 'px-6 sm:px-7 py-3'
      : density === 'compact'
        ? 'px-4 py-2'
        : 'px-5 sm:px-6 py-2.5'

  const prePadding =
    density === 'spacious'
      ? 'px-6 sm:px-7 py-4'
      : density === 'compact'
        ? 'px-4 py-2.5'
        : 'px-5 sm:px-6 py-3.5'

  const footerPadding =
    density === 'spacious'
      ? 'px-6 sm:px-7 py-4'
      : density === 'compact'
        ? 'px-4 py-2.5'
        : 'px-5 sm:px-6 py-3.5'

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30">
      <div className={`flex flex-col ${bodyPadding}`}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-pretty text-base font-semibold leading-snug">{rule.title}</h3>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{lines.length} lines</span>
        </div>
        <p className="line-clamp-2 text-pretty text-sm leading-relaxed text-muted-foreground">{rule.description}</p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {rule.tags.map((tag) => (
            <li key={tag} className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs text-secondary-foreground">
              {tag}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-auto border-t border-border bg-code">
        <div className={`flex items-center justify-between border-b border-border ${headerPadding}`}>
          <span className="font-mono text-xs text-muted-foreground">.cursorrules</span>
          <CopyButton text={rule.content} label={`${rule.title} rules`} />
        </div>
        <pre className={`overflow-hidden font-mono text-xs leading-relaxed ${prePadding}`} aria-label={`${rule.title} rules preview`}>
          <code className="grid">
            {preview.map((line, index) => (
              <span key={index} className="grid grid-cols-[2ch_1fr] gap-3">
                <span aria-hidden="true" className="select-none text-right text-muted-foreground/50">
                  {index + 1}
                </span>
                <span className="truncate text-foreground/85">{line || ' '}</span>
              </span>
            ))}
          </code>
        </pre>
        {hiddenCount > 0 && (
          <p className={`border-t border-border font-mono text-xs text-muted-foreground ${density === 'compact' ? 'px-4 py-1.5' : 'px-5 sm:px-6 py-2'}`}>
            {`+ ${hiddenCount} more lines — copy to get the full ruleset`}
          </p>
        )}
      </div>

      <footer className={`flex items-center justify-between gap-3 border-t border-border text-xs text-muted-foreground ${footerPadding}`}>
        <span>
          by{' '}
          {rule.author.url ? (
            <a href={rule.author.url} target="_blank" rel="noreferrer" className="text-foreground hover:text-primary">
              @{rule.author.name}
            </a>
          ) : (
            <span className="text-foreground">@{rule.author.name}</span>
          )}
        </span>
        <div className="flex items-center gap-3">
          <span className="font-mono">{rule.slug}.json</span>
          <UpvoteButton slug={rule.slug} initialCount={rule.upvotes} />
        </div>
      </footer>
    </article>
  )
}
