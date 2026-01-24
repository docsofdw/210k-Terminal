import { getAllCompanies } from "@/actions/companies"
import { getPositionsWithCompanies, getTransactionsWithCompanies } from "@/actions/portfolio"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/lib/auth/permissions"
import { ArrowLeftRight } from "lucide-react"
import { AddTransactionDialog } from "../_components/add-transaction-dialog"
import { TransactionsTable } from "../_components/transactions-table"
import { db } from "@/db"
import { btcPrices } from "@/db/schema/btc-prices"
import { desc } from "drizzle-orm"

export default async function TransactionsPage() {
  await requireAuth()

  // Fetch data in parallel
  const [transactions, companies, positions, latestBtcPrice] = await Promise.all([
    getTransactionsWithCompanies(),
    getAllCompanies(),
    getPositionsWithCompanies(),
    db.query.btcPrices.findFirst({
      orderBy: [desc(btcPrices.priceAt)]
    })
  ])

  const btcPrice = latestBtcPrice ? parseFloat(latestBtcPrice.priceUsd) : 0

  // Calculate totals
  const buyTotal = transactions
    .filter(t => t.transaction.type === "buy")
    .reduce((sum, t) => sum + parseFloat(t.transaction.totalValueUsd || t.transaction.totalValue), 0)

  const sellTotal = transactions
    .filter(t => t.transaction.type === "sell")
    .reduce((sum, t) => sum + parseFloat(t.transaction.totalValueUsd || t.transaction.totalValue), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ArrowLeftRight className="h-6 w-6 text-terminal-orange" />
            Transactions
          </h1>
          <p className="text-xs text-muted-foreground">
            View and manage your portfolio transactions
          </p>
        </div>
        <AddTransactionDialog
          companies={companies}
          positions={positions}
          btcPrice={btcPrice}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total Transactions
          </div>
          <div className="text-xl font-bold text-terminal-orange">
            {transactions.length}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total Bought
          </div>
          <div className="text-xl font-bold text-positive">
            ${buyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total Sold
          </div>
          <div className="text-xl font-bold text-negative">
            ${sellTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Net Investment
          </div>
          <div className="text-xl font-bold">
            ${(buyTotal - sellTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            All your buy and sell transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionsTable transactions={transactions} />
        </CardContent>
      </Card>
    </div>
  )
}
