export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header added in Prompt 12 */}
      <main className="flex-1">{children}</main>
      {/* Footer TBD */}
    </div>
  )
}
