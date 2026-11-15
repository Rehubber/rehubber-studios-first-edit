import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { ToolDetailCard } from '@/components/tool-detail-card'
import { getAllRules, getRuleBySlug } from '@/lib/rules'

export async function generateStaticParams() {
  const rules = await getAllRules()
  return rules.map((rule) => ({ slug: rule.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const rule = await getRuleBySlug(slug)
  if (!rule) {
    return {
      title: 'Tool not found',
    }
  }

  const description =
    rule.description?.trim() || `${rule.title} open-source developer tool listed on Rehubber.`
  const url = `https://www.rehubber.com/tool/${rule.slug}/`

  return {
    title: `${rule.title} — Open Source Tool`,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${rule.title} · Rehubber`,
      description,
      url,
      siteName: 'Rehubber',
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: `${rule.title} · Rehubber`,
      description,
    },
  }
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const rule = await getRuleBySlug(slug)

  if (!rule) {
    notFound()
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <ToolDetailCard rule={rule} />
      </main>
    </>
  )
}
