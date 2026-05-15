import { Header } from '@/components/layout'
import { Footer } from '@/components/layout'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  )
}
