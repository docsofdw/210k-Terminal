import { getAllCompanies, getSyncHealthStatus, getPortfolioCompanyIds } from "@/actions/companies"
import { getLatestBtcPrice } from "@/actions/market-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { Bitcoin, Building2, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react"
import { BtcPriceHeader } from "./_components/btc-price-header"
import { CompsTable } from "./_components/comps-table"

export default async function CompsPage() {
  const [companies, btcPriceData, syncHealth, portfolioCompanyIds] = await Promise.all([
    getAllCompanies(),
    getLatestBtcPrice(),
    getSyncHealthStatus(),
    getPortfolioCompanyIds()
  ])

  // Default BTC price if no data in DB yet
  const btcPrice = btcPriceData ? Number(btcPriceData.priceUsd) : 100000
  const change24h = btcPriceData ? Number(btcPriceData.change24h) : 0
  const high24h = btcPriceData ? Number(btcPriceData.high24h) : undefined
  const low24h = btcPriceData ? Number(btcPriceData.low24h) : undefined

  // Calculate summary stats
  const totalBtcHoldings = companies.reduce(
    (sum, c) => sum + (Number(c.btcHoldings) || 0),
    0
  )
  const totalBtcValue = totalBtcHoldings * btcPrice

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <TrendingUp className="h-6 w-6 text-muted-foreground" />
            Treasury Comps
          </h1>
          <p className="text-xs text-muted-foreground">
            Comparative analysis of Bitcoin treasury companies
            {syncHealth.lastSynced && (
              <span className="ml-2 text-muted-foreground/60">
                · Last sync: {new Date(syncHealth.lastSynced).toLocaleString()}
              </span>
            )}
          </p>
        </div>

        {/* Sync Health Indicator */}
        <Tooltip>
          <TooltipTrigger>
            <Badge
              variant={syncHealth.quality === "healthy" ? "default" : "destructive"}
              className={`flex items-center gap-1 ${
                syncHealth.quality === "healthy"
                  ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                  : syncHealth.quality === "degraded"
                    ? "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
                    : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
              }`}
            >
              {syncHealth.quality === "healthy" ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              Data {syncHealth.quality === "healthy" ? "Healthy" : syncHealth.quality === "degraded" ? "Degraded" : "Issues"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[250px]">
            <div className="space-y-1 text-xs">
              <div className="font-semibold">Sync Health: {syncHealth.quality}</div>
              {syncHealth.companiesWithMissingData > 0 ? (
                <div>
                  {syncHealth.companiesWithMissingData} of {syncHealth.totalCompanies} companies
                  have incomplete data
                </div>
              ) : (
                <div>All companies have complete data</div>
              )}
              {syncHealth.lastSynced && (
                <div className="text-muted-foreground">
                  Last synced: {new Date(syncHealth.lastSynced).toLocaleString()}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* BTC Price Header */}
      <BtcPriceHeader
        price={btcPrice}
        change24h={change24h}
        high24h={high24h}
        low24h={low24h}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Companies Tracked
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companies.length}</div>
            <p className="text-xs text-muted-foreground">
              Active treasury companies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total BTC Holdings
            </CardTitle>
            <Bitcoin className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("en-US", {
                maximumFractionDigits: 0
              }).format(totalBtcHoldings)}{" "}
              BTC
            </div>
            <p className="text-xs text-muted-foreground">
              ≈ $
              {new Intl.NumberFormat("en-US", {
                notation: "compact",
                maximumFractionDigits: 1
              }).format(totalBtcValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">BTC Price</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {new Intl.NumberFormat("en-US", {
                maximumFractionDigits: 0
              }).format(btcPrice)}
            </div>
            <p className="text-xs text-muted-foreground">Current spot price</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Comps Table */}
      {companies.length > 0 ? (
        <CompsTable companies={companies} portfolioCompanyIds={portfolioCompanyIds} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No companies yet</h3>
            <p className="text-muted-foreground">
              Run the sync script to add treasury companies from Google Sheets.
            </p>
            <code className="mt-2 rounded bg-muted px-2 py-1 text-sm">
              npx bun db/seed/sync-from-sheets.ts
            </code>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
