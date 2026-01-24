import { getAllCompanies } from "@/actions/companies"
import { getLatestBtcPrice, getLatestStockPrices } from "@/actions/market-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bitcoin, Building2, TrendingUp } from "lucide-react"
import { BtcPriceHeader } from "./_components/btc-price-header"
import { CompsTable } from "./_components/comps-table"
import { FilterBar } from "./_components/filter-bar"

export default async function CompsPage() {
  const [companies, btcPriceData, stockPricesMap] = await Promise.all([
    getAllCompanies(),
    getLatestBtcPrice(),
    getLatestStockPrices()
  ])

  // Default BTC price if no data in DB yet
  const btcPrice = btcPriceData ? Number(btcPriceData.priceUsd) : 100000
  const change24h = btcPriceData ? Number(btcPriceData.change24h) : 0
  const high24h = btcPriceData ? Number(btcPriceData.high24h) : undefined
  const low24h = btcPriceData ? Number(btcPriceData.low24h) : undefined

  // Convert stock prices map
  const stockPrices = new Map<string, number>()
  stockPricesMap.forEach((price, companyId) => {
    stockPrices.set(companyId, Number(price.price))
  })

  // Placeholder FX rates (will be fetched from DB in production)
  const fxRates = new Map<string, number>([
    ["CAD", 1.35],
    ["JPY", 150],
    ["EUR", 0.92],
    ["GBP", 0.79],
    ["HKD", 7.8],
    ["AUD", 1.55]
  ])

  // Calculate summary stats
  const totalBtcHoldings = companies.reduce(
    (sum, c) => sum + (Number(c.btcHoldings) || 0),
    0
  )
  const totalBtcValue = totalBtcHoldings * btcPrice

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <TrendingUp className="h-8 w-8 text-muted-foreground" />
          Treasury Comps
        </h1>
        <p className="text-muted-foreground">
          Comparative analysis of Bitcoin treasury companies
        </p>
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

      {/* Filter Bar */}
      <FilterBar lastUpdated={btcPriceData?.priceAt || undefined} />

      {/* Main Comps Table */}
      {companies.length > 0 ? (
        <CompsTable
          companies={companies}
          btcPrice={btcPrice}
          stockPrices={stockPrices}
          fxRates={fxRates}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No companies yet</h3>
            <p className="text-muted-foreground">
              Run the seed script to add treasury companies.
            </p>
            <code className="mt-2 rounded bg-muted px-2 py-1 text-sm">
              npx bun db/seed/companies.ts
            </code>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
