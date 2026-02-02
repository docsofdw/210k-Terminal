import { requireAuth } from "@/lib/auth/permissions"
import { getLatestBtcPrice } from "@/actions/market-data"
import { getClearStreetDashboardData } from "@/actions/clear-street"
import { TrendingUp } from "lucide-react"
import { DerivativesUnified } from "./_components/derivatives-unified"

export default async function DerivativesPositionsPage() {
  await requireAuth()

  // Fetch initial data server-side
  const [btcPrice, clearStreetData] = await Promise.all([
    getLatestBtcPrice(),
    getClearStreetDashboardData()
  ])

  const currentBtcPrice = btcPrice ? parseFloat(btcPrice.priceUsd) : 95000

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <TrendingUp className="h-6 w-6 text-terminal-orange" />
          Derivatives
        </h1>
        <p className="text-xs text-muted-foreground">
          Clear Street positions with real-time Greeks and strategy simulation
        </p>
      </div>

      <DerivativesUnified
        initialBtcPrice={currentBtcPrice}
        initialPositions={
          clearStreetData.isSuccess && clearStreetData.data?.positions
            ? clearStreetData.data.positions
            : null
        }
        initialPnl={
          clearStreetData.isSuccess && clearStreetData.data?.pnl
            ? clearStreetData.data.pnl
            : null
        }
        initialError={
          !clearStreetData.isSuccess ? clearStreetData.error : undefined
        }
      />
    </div>
  )
}
