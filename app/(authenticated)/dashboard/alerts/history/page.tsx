import { getAlertHistoryWithDetails } from "@/actions/alerts"
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
import { requireAuth } from "@/lib/auth/permissions"
import { History, CheckCircle, XCircle } from "lucide-react"

const alertTypeLabels: Record<string, string> = {
  price_above: "Price Above",
  price_below: "Price Below",
  mnav_above: "mNAV Above",
  mnav_below: "mNAV Below",
  btc_holdings: "Holdings Change",
  pct_change_up: "% Up",
  pct_change_down: "% Down"
}

export default async function AlertHistoryPage() {
  await requireAuth()

  const history = await getAlertHistoryWithDetails()

  const successCount = history.filter(h => h.history.notificationSent).length
  const failedCount = history.filter(h => !h.history.notificationSent).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <History className="h-6 w-6 text-terminal-orange" />
          Alert History
        </h1>
        <p className="text-xs text-muted-foreground">
          View triggered alerts and notification status
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total Triggered
          </div>
          <div className="text-xl font-bold text-terminal-orange">
            {history.length}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Sent Successfully
          </div>
          <div className="text-xl font-bold text-positive">{successCount}</div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Failed
          </div>
          <div className="text-xl font-bold text-negative">{failedCount}</div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Triggered Alerts</CardTitle>
          <CardDescription>
            History of all triggered alerts and notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No alerts have been triggered yet.</p>
            </div>
          ) : (
            <div className="rounded-sm border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map(({ history: h, alert, company }) => {
                    const actualValue = h.actualValue
                      ? parseFloat(h.actualValue)
                      : null
                    const threshold = h.threshold
                      ? parseFloat(h.threshold)
                      : null

                    return (
                      <TableRow key={h.id}>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {new Date(h.triggeredAt).toLocaleString()}
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
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {alertTypeLabels[h.alertType] || h.alertType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {actualValue !== null ? (
                            h.alertType.includes("mnav") ? (
                              `${actualValue.toFixed(2)}x`
                            ) : h.alertType.includes("pct") ? (
                              `${actualValue.toFixed(2)}%`
                            ) : (
                              `$${actualValue.toLocaleString()}`
                            )
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {threshold !== null ? (
                            h.alertType.includes("mnav") ? (
                              `${threshold.toFixed(2)}x`
                            ) : h.alertType.includes("pct") ? (
                              `${threshold.toFixed(2)}%`
                            ) : (
                              `$${threshold.toLocaleString()}`
                            )
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {h.channel.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {h.notificationSent ? (
                            <div className="flex items-center gap-1 text-positive">
                              <CheckCircle className="h-3 w-3" />
                              <span className="text-[10px]">Sent</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-negative">
                              <XCircle className="h-3 w-3" />
                              <span className="text-[10px]">
                                {h.notificationError || "Failed"}
                              </span>
                            </div>
                          )}
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
