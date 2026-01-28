import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/lib/auth/permissions"
import { Wallet } from "lucide-react"
import { db } from "@/db"
import { fundPositions } from "@/db/schema/fund-positions"
import { companies } from "@/db/schema/companies"
import { btcPrices } from "@/db/schema/btc-prices"
import { desc, eq } from "drizzle-orm"
import { FundPositionsTable } from "./_components/fund-positions-table"

export default async function PortfolioPage() {
  await requireAuth()

  // Fetch fund positions with company data
  const positions = await db
    .select({
      position: fundPositions,
      company: companies
    })
    .from(fundPositions)
    .leftJoin(companies, eq(fundPositions.companyId, companies.id))
    .orderBy(desc(fundPositions.valueUsd))

  const latestBtcPrice = await db.query.btcPrices.findFirst({
    orderBy: [desc(btcPrices.priceAt)]
  })

  const btcPrice = latestBtcPrice ? parseFloat(latestBtcPrice.priceUsd) : 0
  const lastSynced = positions[0]?.position.syncedAt

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Wallet className="h-6 w-6 text-terminal-orange" />
            Portfolio
          </h1>
          <p className="text-xs text-muted-foreground">
            Fund positions synced from Google Sheets
            {lastSynced && (
              <span className="ml-2 text-muted-foreground/60">
                · Last sync: {new Date(lastSynced).toLocaleString()}
              </span>
            )}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Positions</CardTitle>
          <CardDescription>
            Current fund holdings across all categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FundPositionsTable
            positions={positions}
            btcPrice={btcPrice}
          />
        </CardContent>
      </Card>
    </div>
  )
}
