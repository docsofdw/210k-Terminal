import { getCustomerByUserId } from "@/actions/customers"
import { auth } from "@clerk/nextjs/server"
import { AlertCircle, Users } from "lucide-react"

export default async function BillingPage() {
  const { userId } = await auth()

  if (!userId) {
    return (
      <div>
        <div className="bg-destructive/10 flex items-center gap-3 rounded-lg p-4">
          <AlertCircle className="text-destructive h-5 w-5" />
          <p className="text-foreground text-sm">
            Unable to load account information. Please try again.
          </p>
        </div>
      </div>
    )
  }

  const customer = await getCustomerByUserId(userId)

  if (!customer) {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Please complete your profile setup to access account information.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Users className="text-muted-foreground h-8 w-8" />
          Account Details
        </h1>
        <p className="text-muted-foreground">View your account information</p>
      </div>

      <div className="mt-8 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Role</h2>
          <p className="text-muted-foreground capitalize">{customer.role}</p>
        </div>
        {customer.name && (
          <div>
            <h2 className="text-lg font-semibold">Name</h2>
            <p className="text-muted-foreground">{customer.name}</p>
          </div>
        )}
        {customer.email && (
          <div>
            <h2 className="text-lg font-semibold">Email</h2>
            <p className="text-muted-foreground">{customer.email}</p>
          </div>
        )}
      </div>
    </div>
  )
}
