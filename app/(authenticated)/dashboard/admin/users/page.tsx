import { getAllCustomers } from "@/actions/customers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAdmin } from "@/lib/auth/permissions"
import { Shield, Users } from "lucide-react"
import { UsersTable } from "./_components/users-table"

export default async function AdminUsersPage() {
  const currentUser = await requireAdmin()
  const users = await getAllCustomers()

  const adminCount = users.filter(u => u.role === "admin").length
  const viewerCount = users.filter(u => u.role === "viewer").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Users className="h-8 w-8 text-muted-foreground" />
          Manage Users
        </h1>
        <p className="text-muted-foreground">
          View and manage user roles. Role changes are logged.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-2xl">{users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Shield className="h-3 w-3" /> Admins
            </CardDescription>
            <CardTitle className="text-2xl">{adminCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Viewers</CardDescription>
            <CardTitle className="text-2xl">{viewerCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Manage user access levels. You cannot change your own role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable users={users} currentUserId={currentUser.userId} />
        </CardContent>
      </Card>
    </div>
  )
}
