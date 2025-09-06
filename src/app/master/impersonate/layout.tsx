'use client'

export default function ImpersonateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Don't wrap with any authentication - the page will handle it manually
  return <>{children}</>
}