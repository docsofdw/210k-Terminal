import { getAllCompanies } from "@/actions/companies"
import { getLatestBtcPrice, getLatestStockPrices } from "@/actions/market-data"
import { getWatchlist } from "@/actions/watchlist"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/lib/auth/permissions"
import { Star, TrendingUp } from "lucide-react"
import { AddToWatchlistDialog } from "./_components/add-to-watchlist-dialog"
import { WatchlistTable } from "./_components/watchlist-table"

export default async function WatchlistPage() {
  await requireAuth()

  const [watchlistItems, companies, btcPriceData, stockPricesMap] =
    await Promise.all([
      getWatchlist(),
      getAllCompanies(),
      getLatestBtcPrice(),
      getLatestStockPrices()
    ])

  const btcPrice = btcPriceData ? Number(btcPriceData.priceUsd) : 100000

  // Convert stock prices map to Record
  const stockPrices: Record<string, number> = {}
  stockPricesMap.forEach((price, companyId) => {
    stockPrices[companyId] = Number(price.price)
  })

  // Get IDs of companies already in watchlist
  const existingCompanyIds = watchlistItems.map(item => item.company.id)

  // Calculate summary stats
  const totalBtcHoldings = watchlistItems.reduce((sum, { company }) => {
    return sum + (company.btcHoldings ? parseFloat(company.btcHoldings) : 0)
  }, 0)

  const totalValue = watchlistItems.reduce((sum, { company }) => {
    const price = stockPrices[company.id] || 0
    const shares = company.sharesOutstanding
      ? parseFloat(company.sharesOutstanding)
      : 0
    return sum + price * shares
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Star className="h-6 w-6 text-terminal-orange" />
            Watchlist
          </h1>
          <p className="text-xs text-muted-foreground">
            Track your favorite treasury companies
          </p>
        </div>
        <AddToWatchlistDialog
          companies={companies}
          existingCompanyIds={existingCompanyIds}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Companies Watched
          </div>
          <div className="text-xl font-bold text-terminal-orange">
            {watchlistItems.length}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total BTC Holdings
          </div>
          <div className="text-xl font-bold">
            {totalBtcHoldings.toLocaleString(undefined, {
              maximumFractionDigits: 0
            })}{" "}
            BTC
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Combined Market Cap
          </div>
          <div className="text-xl font-bold">
            $
            {(totalValue / 1_000_000_000).toLocaleString(undefined, {
              maximumFractionDigits: 1
            })}
            B
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            BTC Price
          </div>
          <div className="text-xl font-bold">
            ${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-terminal-orange" />
            Watched Companies
          </CardTitle>
          <CardDescription>
            Your personal list of treasury companies to track
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WatchlistTable
            items={watchlistItems}
            btcPrice={btcPrice}
            stockPrices={stockPrices}
          />
        </CardContent>
      </Card>
    </div>
  )
}
