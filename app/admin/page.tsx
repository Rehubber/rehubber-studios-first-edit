import type { Metadata } from 'next'
import { AdminDashboard } from '@/components/admin-dashboard'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: 'Moderation dashboard',
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return (
    <>
      <SiteHeader />
      <AdminDashboard />
    </>
  )
}
