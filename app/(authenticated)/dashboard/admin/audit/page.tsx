import { getCustomerByUserId } from "@/actions/customers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@clerk/nextjs/server"
import { ClipboardList, Shield } from "lucide-react"
import { redirect } from "next/navigation"

export default async function AdminAuditPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/login")
  }

  const customer = await getCustomerByUserId(userId)

  if (!customer || customer.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <ClipboardList className="h-8 w-8 text-muted-foreground" />
          Audit Log
        </h1>
        <p className="text-muted-foreground">
          View all data changes and admin actions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Audit logging will be implemented in Phase 4. This will include:
          </p>
          <ul className="mt-4 list-disc list-inside text-muted-foreground space-y-1">
            <li>All data changes with before/after values</li>
            <li>User action tracking</li>
            <li>Timestamp and IP logging</li>
            <li>Export functionality</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
