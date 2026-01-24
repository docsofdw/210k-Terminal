import { getRecentAuditLogs } from "@/actions/audit"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { requireAdmin } from "@/lib/auth/permissions"
import { ClipboardList, Plus, Pencil, Trash2 } from "lucide-react"

const actionIcons = {
  create: Plus,
  update: Pencil,
  delete: Trash2
}

const actionColors = {
  create: "bg-green-500/10 text-green-500",
  update: "bg-blue-500/10 text-blue-500",
  delete: "bg-red-500/10 text-red-500"
}

export default async function AdminAuditPage() {
  await requireAdmin()
  const logs = await getRecentAuditLogs(100)

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
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Last 100 changes to companies, users, and holdings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No audit logs yet. Changes will appear here.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => {
                    const Icon = actionIcons[log.action]
                    const colorClass = actionColors[log.action]

                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${colorClass}`}>
                            <Icon className="h-3 w-3" />
                            {log.action}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <Badge variant="outline">{log.entity}</Badge>
                            {log.entityName && (
                              <span className="ml-2 text-sm">{log.entityName}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm">
                          {log.description || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.userEmail || log.userId.slice(0, 8) + "..."}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.createdAt.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
