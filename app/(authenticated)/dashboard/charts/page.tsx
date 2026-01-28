import { getMarketSnapshots, getLatestMarketSnapshot, getCompanySnapshotsByTicker } from "@/actions/snapshots"
import { getAllCompanies } from "@/actions/companies"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/lib/auth/permissions"
import { BarChart3, Bitcoin, TrendingUp, Layers, Building2 } from "lucide-react"
import { MNavChart } from "./_components/mnav-chart"
import { HoldingsChart } from "./_components/holdings-chart"
import { BtcPriceChart } from "./_components/btc-price-chart"
import { DateRangeSelector } from "./_components/date-range-selector"
import { CompanySelector } from "./_components/company-selector"
import { CompanyMNavChart } from "./_components/company-mnav-chart"
import { CompanyPriceChart } from "./_components/company-price-chart"

interface ChartsPageProps {
  searchParams: Promise<{ days?: string; company?: string }>
}

export default async function ChartsPage({ searchParams }: ChartsPageProps) {
  await requireAuth()

  const params = await searchParams
  const daysParam = params.days
  const companyTicker = params.company || null

  // Parse days: 0 means ALL (use a large number), default is 90
  const days = daysParam === "0" ? 3650 : (parseInt(daysParam || "90") || 90)

  const [snapshots, latestSnapshot, companies] = await Promise.all([
    getMarketSnapshots(days),
    getLatestMarketSnapshot(),
    getAllCompanies()
  ])

  // Fetch company-specific data if a company is selected
  const companySnapshots = companyTicker
    ? await getCompanySnapshotsByTicker(companyTicker, days)
    : []

  const selectedCompany = companyTicker
    ? companies.find(c => c.ticker === companyTicker)
    : null

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="h-6 w-6 text-terminal-orange" />
            Charts & Analytics
          </h1>
          <p className="text-xs text-muted-foreground">
            Historical trends and market analysis
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanySelector
            companies={companies.map(c => ({ id: c.id, ticker: c.ticker, name: c.name }))}
            currentTicker={companyTicker}
          />
          <DateRangeSelector currentDays={days} />
        </div>
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

      {/* Company-Specific Charts (when a company is selected) */}
      {selectedCompany && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-terminal-orange" />
                {selectedCompany.name} ({selectedCompany.ticker}) - mNAV History
              </CardTitle>
              <CardDescription>
                Historical mNAV for {selectedCompany.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyMNavChart
                data={companySnapshots}
                companyName={selectedCompany.name}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                {selectedCompany.ticker} Stock Price History
              </CardTitle>
              <CardDescription>
                Historical stock price in {selectedCompany.tradingCurrency}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyPriceChart
                data={companySnapshots}
                companyName={selectedCompany.name}
                currency={selectedCompany.tradingCurrency}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Aggregate Charts (always shown) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-terminal-orange" />
            Market mNAV Trends
          </CardTitle>
          <CardDescription>
            Average, median, and weighted average mNAV across all companies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MNavChart data={snapshots} />
        </CardContent>
      </Card>

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
