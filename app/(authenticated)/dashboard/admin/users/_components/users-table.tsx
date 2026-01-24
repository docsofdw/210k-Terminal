"use client"

import { setCustomerRole } from "@/actions/customers"
import { logAudit } from "@/actions/audit"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import type { SelectCustomer } from "@/db/schema/customers"
import { Loader2, Shield, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface UsersTableProps {
  users: SelectCustomer[]
  currentUserId: string
}

export function UsersTable({ users, currentUserId }: UsersTableProps) {
  const router = useRouter()
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null)

  async function handleRoleChange(userId: string, newRole: "admin" | "viewer") {
    const user = users.find(u => u.userId === userId)
    if (!user) return

    setLoadingUserId(userId)

    try {
      const result = await setCustomerRole(userId, newRole)

      if (result.isSuccess) {
        // Log the role change
        await logAudit({
          action: "update",
          entity: "user",
          entityId: user.id,
          entityName: user.email || user.name || userId,
          changesBefore: { role: user.role },
          changesAfter: { role: newRole },
          description: `Changed role for ${user.email || user.name}: ${user.role} → ${newRole}`
        })

        toast.success(`Role updated to ${newRole}`)
        router.refresh()
      } else {
        toast.error("Failed to update role")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setLoadingUserId(null)
    }
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-[150px]">Change Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map(user => {
            const isCurrentUser = user.userId === currentUserId
            const isLoading = loadingUserId === user.userId

            return (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {user.role === "admin" ? (
                      <Shield className="h-4 w-4 text-orange-500" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">
                      {user.name || "Unnamed User"}
                    </span>
                    {isCurrentUser && (
                      <Badge variant="outline" className="ml-2">
                        You
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email || "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {isCurrentUser ? (
                    <span className="text-sm text-muted-foreground">-</span>
                  ) : (
                    <Select
                      value={user.role}
                      onValueChange={value =>
                        handleRoleChange(user.userId, value as "admin" | "viewer")
                      }
                      disabled={isLoading}
                    >
                      <SelectTrigger className="w-[120px]">
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
