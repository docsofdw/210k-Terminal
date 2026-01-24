import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { History } from "lucide-react"

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <History className="h-8 w-8 text-muted-foreground" />
          Historical Snapshots
        </h1>
        <p className="text-muted-foreground">
          View comps table at any point in time
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Historical snapshot viewer will be implemented in Phase 6.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
