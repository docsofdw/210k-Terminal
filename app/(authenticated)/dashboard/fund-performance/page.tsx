import { getFundVsBtcComparison, getFundReturnsData, getLatestFundPerformanceSnapshot, getFundSummaryStats, getFundPerformanceSnapshots, getLiveFundStats, getHistoricalSummaryStats } from "@/actions/fund-performance"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/lib/auth/permissions"
import { Wallet, TrendingUp, BarChart3, LineChart, Calendar } from "lucide-react"
import { FundVsBtcChart } from "../charts/_components/fund-vs-btc-chart"
import { FundReturnsChart } from "../charts/_components/fund-returns-chart"
import Link from "next/link"

interface FundPerformancePageProps {
  searchParams: Promise<{ range?: string }>
}

export default async function FundPerformancePage({ searchParams }: FundPerformancePageProps) {
  await requireAuth()

  const params = await searchParams
  const rangeParam = params.range || "all"

  // Parse range: "1y" = 365 days, "2y" = 730, "all" = 3650
  const days = rangeParam === "1y" ? 365 : rangeParam === "2y" ? 730 : 3650

  const [fundComparison, fundReturns, latestFundSnapshot, fundSummary, allSnapshots, liveStats, historicalSummary] = await Promise.all([
    getFundVsBtcComparison(days),
    getFundReturnsData(days),
    getLatestFundPerformanceSnapshot(),
    getFundSummaryStats(),
    getFundPerformanceSnapshots(days),
    getLiveFundStats(),
    getHistoricalSummaryStats()
  ])

  // Build range URLs
  const buildRangeUrl = (range: string) => `?range=${range}`

  // Calculate some additional stats
  const totalMonths = fundReturns.length
  const positiveMonths = fundReturns.filter(r => r.netReturnMtd && r.netReturnMtd > 0).length
  const negativeMonths = fundReturns.filter(r => r.netReturnMtd && r.netReturnMtd < 0).length
  const winRate = totalMonths > 0 ? (positiveMonths / totalMonths * 100).toFixed(0) : "N/A"

  // Find best and worst months
  const sortedReturns = [...fundReturns].filter(r => r.netReturnMtd !== null).sort((a, b) => (b.netReturnMtd || 0) - (a.netReturnMtd || 0))
  const bestMonth = sortedReturns[0]
  const worstMonth = sortedReturns[sortedReturns.length - 1]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Wallet className="h-6 w-6 text-terminal-orange" />
            Fund Performance
          </h1>
          <p className="text-xs text-muted-foreground">
            210k Capital fund analytics and historical performance
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border/50 bg-muted/30 p-1">
          <Link
            href={buildRangeUrl("1y")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              rangeParam === "1y"
                ? "bg-background text-terminal-orange shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            }`}
          >
            1Y
          </Link>
          <Link
            href={buildRangeUrl("2y")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              rangeParam === "2y"
                ? "bg-background text-terminal-orange shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            }`}
          >
            2Y
          </Link>
          <Link
            href={buildRangeUrl("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              rangeParam === "all"
                ? "bg-background text-terminal-orange shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            }`}
          >
            ALL
          </Link>
        </div>
      </div>

      {/* Summary Cards - Row 1 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Fund AUM
          </div>
          <div className="text-xl font-bold text-terminal-orange">
            {liveStats?.liveAumUsd
              ? new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  notation: "compact",
                  maximumFractionDigits: 1
                }).format(liveStats.liveAumUsd)
              : fundSummary?.fundAumUsd
                ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    notation: "compact",
                    maximumFractionDigits: 1
                  }).format(fundSummary.fundAumUsd)
                : "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {liveStats ? "live" : fundSummary?.lastSnapshotDate
              ? `as of ${new Date(fundSummary.lastSnapshotDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
              : ""}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            YTD Return
          </div>
          <div className={`text-xl font-bold ${
            fundSummary?.netReturnYtd !== undefined && fundSummary.netReturnYtd >= 0
              ? "text-green-500"
              : "text-red-500"
          }`}>
            {fundSummary?.netReturnYtd !== undefined
              ? `${fundSummary.netReturnYtd >= 0 ? "+" : ""}${(fundSummary.netReturnYtd * 100).toFixed(1)}%`
              : "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {fundSummary?.monthsIncluded
              ? `${fundSummary.monthsIncluded} month${fundSummary.monthsIncluded > 1 ? "s" : ""}${fundSummary.liveMtdUsed ? " (incl. live)" : ""}`
              : `${new Date().getFullYear()} year-to-date`}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            MTD Return
          </div>
          <div className={`text-xl font-bold ${
            liveStats?.fundMtdReturn !== null && liveStats?.fundMtdReturn !== undefined
              ? liveStats.fundMtdReturn >= 0 ? "text-green-500" : "text-red-500"
              : latestFundSnapshot?.netReturnMtd && parseFloat(latestFundSnapshot.netReturnMtd) >= 0
                ? "text-green-500"
                : "text-red-500"
          }`}>
            {liveStats?.fundMtdReturn !== null && liveStats?.fundMtdReturn !== undefined
              ? `${liveStats.fundMtdReturn >= 0 ? "+" : ""}${(liveStats.fundMtdReturn * 100).toFixed(1)}%`
              : latestFundSnapshot?.netReturnMtd
                ? `${(parseFloat(latestFundSnapshot.netReturnMtd) * 100).toFixed(1)}%`
                : "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {liveStats ? new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })
              : latestFundSnapshot?.snapshotDate
                ? new Date(latestFundSnapshot.snapshotDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : ""}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Win Rate
          </div>
          <div className="text-xl font-bold">
            {winRate}%
          </div>
          <div className="text-[10px] text-muted-foreground">
            {positiveMonths} up / {negativeMonths} down
          </div>
        </div>
      </div>

      {/* Summary Cards - Row 2 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total Return (ITD)
          </div>
          <div className={`text-xl font-bold ${
            historicalSummary?.totalReturnNet && historicalSummary.totalReturnNet > 0
              ? "text-green-500"
              : "text-red-500"
          }`}>
            {historicalSummary?.totalReturnNet
              ? `+${historicalSummary.totalReturnNet.toFixed(1)}%`
              : "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            net since inception
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            IRR
          </div>
          <div className={`text-xl font-bold ${
            historicalSummary?.irr && historicalSummary.irr > 0
              ? "text-green-500"
              : "text-foreground"
          }`}>
            {historicalSummary?.irr
              ? `${historicalSummary.irr.toFixed(1)}%`
              : "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            internal rate of return
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            BTC Outperformance
          </div>
          <div className={`text-xl font-bold ${
            historicalSummary?.btcOutperformance && historicalSummary.btcOutperformance > 0
              ? "text-terminal-orange"
              : "text-red-500"
          }`}>
            {historicalSummary?.btcOutperformance
              ? `+${historicalSummary.btcOutperformance.toFixed(1)}%`
              : "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            alpha vs Bitcoin
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Inception
          </div>
          <div className="text-xl font-bold">
            {allSnapshots.length > 0
              ? new Date(allSnapshots[0].snapshotDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
              : "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {totalMonths} months of data
          </div>
        </div>
      </div>

      {/* Summary Cards - Row 3: Monthly Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Best Month
          </div>
          <div className="text-xl font-bold text-green-500">
            {bestMonth?.netReturnMtd
              ? `+${bestMonth.netReturnMtd.toFixed(1)}%`
              : "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {bestMonth?.date
              ? new Date(bestMonth.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })
              : ""}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Worst Month
          </div>
          <div className="text-xl font-bold text-red-500">
            {worstMonth?.netReturnMtd
              ? `${worstMonth.netReturnMtd.toFixed(1)}%`
              : "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {worstMonth?.date
              ? new Date(worstMonth.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })
              : ""}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Avg Monthly Return
          </div>
          <div className={`text-xl font-bold ${
            totalMonths > 0 && fundReturns.reduce((sum, r) => sum + (r.netReturnMtd || 0), 0) / totalMonths > 0
              ? "text-green-500"
              : "text-foreground"
          }`}>
            {totalMonths > 0
              ? `${(fundReturns.reduce((sum, r) => sum + (r.netReturnMtd || 0), 0) / totalMonths).toFixed(1)}%`
              : "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            arithmetic mean
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Hit Rate
          </div>
          <div className="text-xl font-bold">
            {winRate}%
          </div>
          <div className="text-[10px] text-muted-foreground">
            {positiveMonths} up / {negativeMonths} down
          </div>
        </div>
      </div>

      {/* Fund vs BTC Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-terminal-orange" />
            Cumulative Returns: Fund vs Bitcoin
          </CardTitle>
          <CardDescription>
            Shows cumulative percentage return from the start of the period. 0% = starting point, +100% = doubled, -50% = halved.
          </CardDescription>
          <p className="mt-1 text-[10px] text-muted-foreground/70">
            Source: Historical Performance sheet · BTC prices from btc_prices table
          </p>
        </CardHeader>
        <CardContent>
          <FundVsBtcChart data={fundComparison} />
        </CardContent>
      </Card>

      {/* Monthly Returns Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-terminal-orange" />
            Monthly Returns
          </CardTitle>
          <CardDescription>
            Fund net returns by month. Green bars indicate positive returns, red bars indicate negative returns. Orange bars show BTC returns for comparison.
          </CardDescription>
          <p className="mt-1 text-[10px] text-muted-foreground/70">
            Source: Net Returns sheet · Historical Performance sheet · Synced bi-weekly on 1st and 15th
          </p>
        </CardHeader>
        <CardContent>
          <FundReturnsChart data={fundReturns} />
        </CardContent>
      </Card>

      {/* No Data State */}
      {fundReturns.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Wallet className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Fund Performance Data</h3>
            <p className="mt-2 text-muted-foreground">
              Fund performance data will populate once synced from the portfolio spreadsheet.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sync runs on the 1st and 15th of each month.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
