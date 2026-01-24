import { requireAdmin } from "@/lib/auth/permissions"

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode
}) {
  // This will redirect non-admins to /dashboard
  await requireAdmin()

  return <>{children}</>
}
