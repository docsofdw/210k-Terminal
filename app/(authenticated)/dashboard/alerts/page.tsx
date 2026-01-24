import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell } from "lucide-react"

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Bell className="h-8 w-8 text-muted-foreground" />
          Alerts
        </h1>
        <p className="text-muted-foreground">
          Configure price and mNAV alerts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Alert management will be implemented in Phase 5. This will include:
          </p>
          <ul className="mt-4 list-disc list-inside text-muted-foreground space-y-1">
            <li>Price threshold alerts</li>
            <li>mNAV change notifications</li>
            <li>Telegram and Slack integration</li>
            <li>Custom alert conditions</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
