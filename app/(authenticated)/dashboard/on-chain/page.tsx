import {
  getFundingRates,
  get200WMAHeatmap,
  getFearAndGreed,
  getPiCycleTop,
  getBitcoinVolatility,
  getMvrvZScore,
  getNupl
} from "@/actions/on-chain-metrics"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/lib/auth/permissions"
import { Activity, TrendingUp, Gauge, Target, BarChart3, Zap, PieChart } from "lucide-react"
import { FundingRatesChart } from "./_components/funding-rates-chart"
import { Heatmap200WMAChart } from "./_components/heatmap-200wma-chart"
import { FearGreedChart } from "./_components/fear-greed-chart"
import { PiCycleChart } from "./_components/pi-cycle-chart"
import { VolatilityChart } from "./_components/volatility-chart"
import { MvrvZScoreChart } from "./_components/mvrv-zscore-chart"
import { NuplChart } from "./_components/nupl-chart"
import { SummaryCards } from "./_components/summary-cards"
import { DateRangeSelector } from "./_components/date-range-selector"

interface OnChainPageProps {
  searchParams: Promise<{ days?: string }>
}

export default async function OnChainPage({ searchParams }: OnChainPageProps) {
  await requireAuth()

  const params = await searchParams
  const daysParam = params.days

  // Parse days: default is 90
  const days = parseInt(daysParam || "90") || 90

  // Fetch all metrics in parallel
  const [
    fundingRatesData,
    heatmap200WMAData,
    fearGreedData,
    piCycleData,
    volatilityData,
    mvrvData,
    nuplData
  ] = await Promise.all([
    getFundingRates(days),
    get200WMAHeatmap(days),
    getFearAndGreed(days),
    getPiCycleTop(days),
    getBitcoinVolatility(days),
    getMvrvZScore(days),
    getNupl(days)
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Activity className="h-6 w-6 text-terminal-orange" />
            On-Chain Metrics
          </h1>
          <p className="text-xs text-muted-foreground">
            Bitcoin on-chain analytics from Bitcoin Magazine Pro
          </p>
        </div>
        <DateRangeSelector currentDays={days} />
      </div>

      {/* Summary Cards - Quick Glance */}
      <SummaryCards
        fearGreedData={fearGreedData}
        fundingRatesData={fundingRatesData}
        heatmap200WMAData={heatmap200WMAData}
        mvrvData={mvrvData}
      />

      {/* Valuation Metrics - Full Width */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-terminal-orange" />
              MVRV Z-Score
            </CardTitle>
            <CardDescription>
              Market Value to Realized Value - primary valuation metric
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MvrvZScoreChart data={mvrvData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-terminal-orange" />
              NUPL
            </CardTitle>
            <CardDescription>
              Net Unrealized Profit/Loss - market cycle position
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NuplChart data={nuplData} />
          </CardContent>
        </Card>
      </div>

      {/* Sentiment Metrics - 2 Column Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-terminal-orange" />
              Fear & Greed Index
            </CardTitle>
            <CardDescription>
              Market sentiment from 0 (extreme fear) to 100 (extreme greed)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FearGreedChart data={fearGreedData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-terminal-orange" />
              Funding Rates
            </CardTitle>
            <CardDescription>
              Average perpetual futures funding rates across exchanges
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FundingRatesChart data={fundingRatesData} />
          </CardContent>
        </Card>
      </div>

      {/* Price-Based Metrics - Full Width */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-terminal-orange" />
            200 Week Moving Average
          </CardTitle>
          <CardDescription>
            Bitcoin price relative to the 200 week moving average - long-term support
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Heatmap200WMAChart data={heatmap200WMAData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-terminal-orange" />
            Pi Cycle Top Indicator
          </CardTitle>
          <CardDescription>
            Moving average crossover - historically signals market cycle tops
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PiCycleChart data={piCycleData} />
        </CardContent>
      </Card>

      {/* Volatility - Full Width */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-terminal-orange" />
            Bitcoin Volatility
          </CardTitle>
          <CardDescription>
            30-day historical volatility of Bitcoin price movements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VolatilityChart data={volatilityData} />
        </CardContent>
      </Card>
    </div>
  )
}
