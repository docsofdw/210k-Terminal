import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"

export default function ChartsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
          Charts
        </h1>
        <p className="text-muted-foreground">
          Historical analysis and visualizations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Charts and historical analysis will be implemented in Phase 6. This will include:
          </p>
          <ul className="mt-4 list-disc list-inside text-muted-foreground space-y-1">
            <li>mNAV trends over time</li>
            <li>BTC holdings growth charts</li>
            <li>Comparative performance</li>
            <li>Price correlation analysis</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
