import { getAllCompanies } from "@/actions/companies"
import { getAlertsWithCompanies } from "@/actions/alerts"
import { getCurrentUser } from "@/actions/user"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/lib/auth/permissions"
import { Bell } from "lucide-react"
import { AddAlertDialog } from "./_components/add-alert-dialog"
import { AlertsTable } from "./_components/alerts-table"
import { TelegramSetup } from "./_components/telegram-setup"
import { AlertTemplates } from "./_components/alert-templates"

export default async function AlertsPage() {
  await requireAuth()

  const [alerts, companies, currentUser] = await Promise.all([
    getAlertsWithCompanies(),
    getAllCompanies(),
    getCurrentUser()
  ])

  const telegramConnected = !!currentUser?.telegramChatId

  const activeCount = alerts.filter(a => a.alert.status === "active").length
  const pausedCount = alerts.filter(a => a.alert.status === "paused").length
  const totalTriggers = alerts.reduce(
    (sum, a) => sum + parseInt(a.alert.triggerCount?.toString() || "0"),
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bell className="h-6 w-6 text-terminal-orange" />
            Alerts
          </h1>
          <p className="text-xs text-muted-foreground">
            Configure price and mNAV alerts
          </p>
        </div>
        <AddAlertDialog companies={companies} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total Alerts
          </div>
          <div className="text-xl font-bold text-terminal-orange">
            {alerts.length}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Active
          </div>
          <div className="text-xl font-bold text-positive">{activeCount}</div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Paused
          </div>
          <div className="text-xl font-bold text-terminal-yellow">
            {pausedCount}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total Triggers
          </div>
          <div className="text-xl font-bold">{totalTriggers}</div>
        </div>
      </div>

      {/* Quick Setup Section - Show prominently if Telegram not connected or no alerts */}
      {(!telegramConnected || alerts.length === 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <TelegramSetup
            isConnected={telegramConnected}
            telegramUsername={currentUser?.telegramUsername}
          />
          <AlertTemplates
            companies={companies}
            userTelegramConnected={telegramConnected}
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Configured Alerts</CardTitle>
          <CardDescription>
            Your price, mNAV, and holdings change alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertsTable alerts={alerts} />
        </CardContent>
      </Card>
    </div>
  )
}
