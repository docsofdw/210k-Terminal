import { requireAuth } from "@/lib/auth/permissions"
import { getLatestBtcPrice } from "@/actions/market-data"
import { TrendingUp } from "lucide-react"
import { DerivativesSimulator } from "./_components/derivatives-simulator"

export default async function DerivativesPage() {
  await requireAuth()

  const btcPrice = await getLatestBtcPrice()
  const currentBtcPrice = btcPrice ? parseFloat(btcPrice.priceUsd) : 95000

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <TrendingUp className="h-6 w-6 text-terminal-orange" />
          Derivatives Simulator
        </h1>
        <p className="text-xs text-muted-foreground">
          Build and analyze multi-leg options strategies on BTC proxies
        </p>
      </div>

      <DerivativesSimulator initialBtcPrice={currentBtcPrice} />
    </div>
  )
}
