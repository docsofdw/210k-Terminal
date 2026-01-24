import { createCustomer, getCustomerByUserId } from "@/actions/customers"
import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import DashboardClientLayout from "./_components/layout-client"

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const user = await currentUser()

  if (!user) {
    redirect("/login")
  }

  let customer = await getCustomerByUserId(user.id)

  // Create customer record on first login if not exists
  if (!customer) {
    const result = await createCustomer(
      user.id,
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.username || undefined,
      user.emailAddresses[0]?.emailAddress
    )
    if (result.isSuccess && result.data) {
      customer = result.data
    }
  }

  // All authenticated users can access dashboard
  // Role-based restrictions are handled at page/component level
  const userData = {
    name:
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.username || "User",
    email: user.emailAddresses[0]?.emailAddress || "",
    avatar: user.imageUrl,
    role: customer?.role || "viewer"
  }

  return (
    <DashboardClientLayout userData={userData}>
      {children}
    </DashboardClientLayout>
  )
}
