"use client"

import { deleteAlert, toggleAlertStatus } from "@/actions/alerts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import type { SelectAlert } from "@/db/schema/alerts"
import type { SelectCompany } from "@/db/schema/companies"
import { Loader2, Pause, Play, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface AlertsTableProps {
  alerts: {
    alert: SelectAlert
    company: SelectCompany | null
  }[]
}

const alertTypeLabels: Record<string, string> = {
  price_above: "Price Above",
  price_below: "Price Below",
  mnav_above: "mNAV Above",
  mnav_below: "mNAV Below",
  btc_holdings: "Holdings Change",
  pct_change_up: "% Up",
  pct_change_down: "% Down"
}

const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  active: "success",
  paused: "warning",
  triggered: "secondary",
  expired: "outline"
}

export function AlertsTable({ alerts }: AlertsTableProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleToggle(id: string, currentStatus: string) {
    setLoadingId(id)
    try {
      const newStatus = currentStatus === "active" ? "paused" : "active"
      const result = await toggleAlertStatus(id, newStatus)
      if (result.isSuccess) {
        toast.success(`Alert ${newStatus}`)
        router.refresh()
      } else {
        toast.error(result.error || "Failed to update alert")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setLoadingId(null)
    }
  }

  async function handleDelete(id: string) {
    setLoadingId(id)
    try {
      const result = await deleteAlert(id)
      if (result.isSuccess) {
        toast.success("Alert deleted")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to delete alert")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setLoadingId(null)
    }
  }

  if (alerts.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>No alerts configured. Create an alert to get started.</p>
      </div>
    )
  }

  return (
    <div className="rounded-sm border border-border/50">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Threshold</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Triggers</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map(({ alert, company }) => {
            const isLoading = loadingId === alert.id
            const threshold = alert.threshold
              ? parseFloat(alert.threshold)
              : alert.thresholdPercent
                ? parseFloat(alert.thresholdPercent)
                : null

            return (
              <TableRow key={alert.id}>
                <TableCell>
                  <div className="font-medium">
                    {alert.name || `${alertTypeLabels[alert.type]} Alert`}
                  </div>
                  {alert.description && (
                    <div className="text-[10px] text-muted-foreground">
                      {alert.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {company ? (
                    <div>
                      <div className="font-medium">{company.ticker}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {company.name}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Global</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {alertTypeLabels[alert.type] || alert.type}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {threshold !== null ? (
                    alert.thresholdPercent ? (
                      `${threshold}%`
                    ) : alert.type.includes("mnav") ? (
                      `${threshold.toFixed(2)}x`
                    ) : (
                      `$${threshold.toLocaleString()}`
                    )
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {alert.channel.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusColors[alert.status] || "outline"}>
                    {alert.status.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {alert.triggerCount || 0}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggle(alert.id, alert.status)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : alert.status === "active" ? (
                        <Pause className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Play className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(alert.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
