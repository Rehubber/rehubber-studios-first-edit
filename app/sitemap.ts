import type { MetadataRoute } from 'next'
import { getAllRules } from '@/lib/rules'

export const dynamic = 'force-static'

const siteUrl = 'https://www.rehubber.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rules = await getAllRules()
  if (rules.length === 0) {
    throw new Error('Cannot generate the sitemap without the published directory catalog.')
  }

  return [
    { url: `${siteUrl}/` },
    { url: `${siteUrl}/submit/` },
    { url: `${siteUrl}/support/` },
    ...rules.map((rule) => ({ url: `${siteUrl}/tool/${encodeURIComponent(rule.slug)}/` })),
  ]
}
