import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeftRight } from "lucide-react"

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <ArrowLeftRight className="h-8 w-8 text-muted-foreground" />
          Transactions
        </h1>
        <p className="text-muted-foreground">
          View and manage your portfolio transactions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Transaction history will be implemented in Phase 5.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
