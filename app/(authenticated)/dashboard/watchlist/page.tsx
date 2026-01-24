import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Star } from "lucide-react"

export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Star className="h-8 w-8 text-muted-foreground" />
          Watchlist
        </h1>
        <p className="text-muted-foreground">
          Track your favorite treasury companies
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Watchlist feature will be implemented in Phase 6.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
