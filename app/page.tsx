import { Hero } from '@/components/hero'
import { RuleExplorer } from '@/components/rule-explorer'
import { SiteHeader } from '@/components/site-header'
import { getDirectoryPage } from '@/lib/rules'

export default async function HomePage() {
  const page = await getDirectoryPage(1)

  return (
    <main>
      <SiteHeader />
      <Hero />
      <RuleExplorer initialPage={page} />
    </main>
  )
}
