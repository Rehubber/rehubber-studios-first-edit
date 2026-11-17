import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: '/admin',
      },
      {
        userAgent: ['ia_archiver', 'archive.org_bot'],
        disallow: '/',
      },
      {
        userAgent: [
          'GPTBot',
          'ClaudeBot',
          'CCBot',
          'Bytespider',
          'Google-Extended',
          'Applebot-Extended',
          'meta-externalagent',
        ],
        disallow: '/',
      },
    ],
    sitemap: 'https://www.rehubber.com/sitemap.xml',
  }
}
