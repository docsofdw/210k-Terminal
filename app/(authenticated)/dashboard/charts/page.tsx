import { getMarketSnapshots, getLatestMarketSnapshot } from "@/actions/snapshots"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/lib/auth/permissions"
import { BarChart3, Bitcoin, TrendingUp, Layers } from "lucide-react"
import { MNavChart } from "./_components/mnav-chart"
import { HoldingsChart } from "./_components/holdings-chart"
import { BtcPriceChart } from "./_components/btc-price-chart"

export default async function ChartsPage() {
  await requireAuth()

  const [snapshots, latestSnapshot] = await Promise.all([
    getMarketSnapshots(90), // Last 90 days
    getLatestMarketSnapshot()
  ])

  // Summary stats from latest snapshot
  const totalBtcHoldings = latestSnapshot?.totalBtcHoldings
    ? parseFloat(latestSnapshot.totalBtcHoldings)
    : 0
  const avgMNav = latestSnapshot?.avgMNav
    ? parseFloat(latestSnapshot.avgMNav)
    : 0
  const btcPrice = latestSnapshot?.btcPrice
    ? parseFloat(latestSnapshot.btcPrice)
    : 0
  const companyCount = latestSnapshot?.companyCount
    ? parseInt(latestSnapshot.companyCount)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BarChart3 className="h-6 w-6 text-terminal-orange" />
          Charts & Analytics
        </h1>
        <p className="text-xs text-muted-foreground">
          Historical trends and market analysis
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total BTC Holdings
          </div>
          <div className="text-xl font-bold text-terminal-orange">
            {totalBtcHoldings.toLocaleString(undefined, {
              maximumFractionDigits: 0
            })}{" "}
            BTC
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Avg mNAV
          </div>
          <div className="text-xl font-bold">{avgMNav.toFixed(2)}x</div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            BTC Price
          </div>
          <div className="text-xl font-bold">
            ${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Companies Tracked
          </div>
          <div className="text-xl font-bold">{companyCount}</div>
        </div>
      </div>

      {/* mNAV Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-terminal-orange" />
            mNAV Trends
          </CardTitle>
          <CardDescription>
            Average, median, and weighted average mNAV over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MNavChart data={snapshots} />
        </CardContent>
      </Card>

      {/* Holdings Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-terminal-orange" />
            Total BTC Holdings
          </CardTitle>
          <CardDescription>
            Combined Bitcoin holdings across all treasury companies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HoldingsChart data={snapshots} />
        </CardContent>
      </Card>

      {/* BTC Price Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bitcoin className="h-5 w-5 text-[#f7931a]" />
            BTC Price History
          </CardTitle>
          <CardDescription>
            Bitcoin price over the snapshot period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BtcPriceChart data={snapshots} />
        </CardContent>
      </Card>

      {snapshots.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Historical Data Yet</h3>
            <p className="mt-2 text-muted-foreground">
              Charts will populate once daily snapshots are captured.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              The daily snapshot cron runs at midnight UTC.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
