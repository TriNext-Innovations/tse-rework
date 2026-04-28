import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TSE Online — TriNext Growth Proposal',
  description: 'Confidential proposal prepared by TriNext Innovations for Technical Systems Engineering (TSE), April 2026.',
  robots: { index: false, follow: false },
}

export default function ProposalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
