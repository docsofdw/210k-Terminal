import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet } from "lucide-react"

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Wallet className="h-8 w-8 text-muted-foreground" />
          Portfolio
        </h1>
        <p className="text-muted-foreground">
          Track your positions in treasury companies
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Portfolio tracking will be implemented in Phase 5. This will include:
          </p>
          <ul className="mt-4 list-disc list-inside text-muted-foreground space-y-1">
            <li>Position tracking with cost basis</li>
            <li>P&L calculations in USD and BTC</li>
            <li>Portfolio weight percentages</li>
            <li>Transaction history</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
