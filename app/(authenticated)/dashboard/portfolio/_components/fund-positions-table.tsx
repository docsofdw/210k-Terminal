"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import type { SelectCompany } from "@/db/schema/companies"
import type { SelectFundPosition } from "@/db/schema/fund-positions"

interface FundPositionsTableProps {
  positions: {
    position: SelectFundPosition
    company: SelectCompany | null
  }[]
  btcPrice?: number
}

const CATEGORY_LABELS: Record<string, string> = {
  btc: "BTC",
  btc_equities: "Equities",
  cash: "Cash",
  debt: "Debt",
  other: "Other"
}

const CATEGORY_COLORS: Record<string, string> = {
  btc: "bg-terminal-orange/20 text-terminal-orange",
  btc_equities: "bg-blue-500/20 text-blue-400",
  cash: "bg-green-500/20 text-green-400",
  debt: "bg-red-500/20 text-red-400",
  other: "bg-gray-500/20 text-gray-400"
}

export function FundPositionsTable({
  positions,
  btcPrice = 0
}: FundPositionsTableProps) {
  // Calculate totals
  const totalValueUsd = positions.reduce((sum, { position }) => {
    return sum + parseFloat(position.valueUsd)
  }, 0)

  const totalValueBtc = positions.reduce((sum, { position }) => {
    return sum + (position.valueBtc ? parseFloat(position.valueBtc) : 0)
  }, 0)

  // Group by category for summary
  const categoryTotals = positions.reduce(
    (acc, { position }) => {
      const cat = position.category
      if (!acc[cat]) acc[cat] = { usd: 0, btc: 0, count: 0 }
      acc[cat].usd += parseFloat(position.valueUsd)
      acc[cat].btc += position.valueBtc ? parseFloat(position.valueBtc) : 0
      acc[cat].count++
      return acc
    },
    {} as Record<string, { usd: number; btc: number; count: number }>
  )

  if (positions.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>No positions synced yet. Run the portfolio sync to load data.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total Positions
          </div>
          <div className="text-xl font-bold text-terminal-orange">
            {positions.length}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Portfolio Value (USD)
          </div>
          <div className="text-xl font-bold">
            ${totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Portfolio Value (BTC)
          </div>
          <div className="text-xl font-bold text-terminal-orange">
            {totalValueBtc.toFixed(2)} BTC
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            BTC Price
          </div>
          <div className="text-xl font-bold">
            ${btcPrice.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(categoryTotals).map(([cat, data]) => (
          <div
            key={cat}
            className="rounded-sm border border-border/50 bg-card px-3 py-2"
          >
            <Badge className={CATEGORY_COLORS[cat]} variant="secondary">
              {CATEGORY_LABELS[cat] || cat}
            </Badge>
            <div className="mt-1 text-sm font-medium">
              ${data.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {data.count} position{data.count !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>

      {/* Positions Table */}
      <div className="rounded-sm border border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Custodian</TableHead>
              <TableHead>Position</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Value (USD)</TableHead>
              <TableHead className="text-right">Value (BTC)</TableHead>
              <TableHead className="text-right">Weight</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map(({ position, company }) => {
              const quantity = parseFloat(position.quantity)
              const valueUsd = parseFloat(position.valueUsd)
              const valueBtc = position.valueBtc ? parseFloat(position.valueBtc) : 0
              const priceUsd = position.priceUsd ? parseFloat(position.priceUsd) : 0
              const weight = position.weightPercent ? parseFloat(position.weightPercent) : 0

              return (
                <TableRow key={position.id}>
                  <TableCell>
                    <Badge className={CATEGORY_COLORS[position.category]} variant="secondary">
                      {CATEGORY_LABELS[position.category] || position.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {position.custodian}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {company?.ticker || position.positionName}
                      </div>
                      {company && (
                        <div className="text-[10px] text-muted-foreground">
                          {company.name}
                        </div>
                      )}
                      {!company && position.positionName !== position.custodian && (
                        <div className="text-[10px] text-muted-foreground">
                          {position.positionName}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {priceUsd > 0 ? `$${priceUsd.toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${valueUsd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-terminal-orange">
                    {valueBtc > 0 ? valueBtc.toFixed(2) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {weight > 0 ? (
                      <Badge variant="outline">{weight.toFixed(1)}%</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
