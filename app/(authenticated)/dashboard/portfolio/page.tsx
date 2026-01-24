import { getAllCompanies } from "@/actions/companies"
import { getPositionsWithCompanies } from "@/actions/portfolio"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/lib/auth/permissions"
import { Wallet } from "lucide-react"
import { AddPositionDialog } from "./_components/add-position-dialog"
import { PositionsTable } from "./_components/positions-table"
import { db } from "@/db"
import { btcPrices } from "@/db/schema/btc-prices"
import { stockPrices } from "@/db/schema/stock-prices"
import { desc, eq } from "drizzle-orm"

export default async function PortfolioPage() {
  await requireAuth()

  // Fetch data in parallel
  const [positions, companies, latestBtcPrice, latestStockPrices] = await Promise.all([
    getPositionsWithCompanies(),
    getAllCompanies(),
    db.query.btcPrices.findFirst({
      orderBy: [desc(btcPrices.priceAt)]
    }),
    db.query.stockPrices.findMany({
      orderBy: [desc(stockPrices.priceAt)]
    })
  ])

  // Get latest price for each company (using companyId as key)
  const stockPriceMap: Record<string, number> = {}
  const seenCompanyIds = new Set<string>()
  for (const price of latestStockPrices) {
    if (!seenCompanyIds.has(price.companyId)) {
      stockPriceMap[price.companyId] = parseFloat(price.price)
      seenCompanyIds.add(price.companyId)
    }
  }

  const btcPrice = latestBtcPrice ? parseFloat(latestBtcPrice.priceUsd) : 0
  const existingCompanyIds = positions.map(p => p.company.id)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Wallet className="h-6 w-6 text-terminal-orange" />
            Portfolio
          </h1>
          <p className="text-xs text-muted-foreground">
            Track your positions in treasury companies
          </p>
        </div>
        <AddPositionDialog
          companies={companies}
          existingCompanyIds={existingCompanyIds}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Positions</CardTitle>
          <CardDescription>
            Your current holdings across treasury companies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PositionsTable
            positions={positions}
            btcPrice={btcPrice}
            stockPrices={stockPriceMap}
          />
        </CardContent>
      </Card>
    </div>
  )
}
