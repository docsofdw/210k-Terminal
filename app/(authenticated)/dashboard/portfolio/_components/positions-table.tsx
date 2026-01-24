"use client"

import { deletePosition } from "@/actions/portfolio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import type { SelectCompany } from "@/db/schema/companies"
import type { SelectPortfolioPosition } from "@/db/schema/portfolio-positions"
import { Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface PositionsTableProps {
  positions: {
    position: SelectPortfolioPosition
    company: SelectCompany
  }[]
  btcPrice?: number
  stockPrices?: Record<string, number>
}

export function PositionsTable({
  positions,
  btcPrice = 0,
  stockPrices = {}
}: PositionsTableProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const result = await deletePosition(id)
      if (result.isSuccess) {
        toast.success("Position deleted")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to delete position")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setDeletingId(null)
    }
  }

  // Calculate totals
  const totalValueUsd = positions.reduce((sum, { position, company }) => {
    const shares = parseFloat(position.shares)
    const price = stockPrices[company.id] || 0
    return sum + shares * price
  }, 0)

  const totalValueBtc = btcPrice > 0 ? totalValueUsd / btcPrice : 0

  if (positions.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>No positions yet. Add your first position to get started.</p>
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
            ${totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-sm border border-border/50 bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Portfolio Value (BTC)
          </div>
          <div className="text-xl font-bold text-terminal-orange">
            {totalValueBtc.toFixed(4)} BTC
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

      {/* Positions Table */}
      <div className="rounded-sm border border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Value (USD)</TableHead>
              <TableHead className="text-right">Value (BTC)</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-right">Cost Basis</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map(({ position, company }) => {
              const shares = parseFloat(position.shares)
              const price = stockPrices[company.id] || 0
              const valueUsd = shares * price
              const valueBtc = btcPrice > 0 ? valueUsd / btcPrice : 0
              const weight = totalValueUsd > 0 ? (valueUsd / totalValueUsd) * 100 : 0
              const costBasis = position.averageCostBasisUsd
                ? parseFloat(position.averageCostBasisUsd)
                : null
              const pnl = costBasis ? valueUsd - costBasis * shares : null
              const pnlPercent = costBasis && costBasis > 0 ? ((price - costBasis) / costBasis) * 100 : null

              return (
                <TableRow key={position.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{company.ticker}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {company.name}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {shares.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-terminal-orange">
                    {valueBtc.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{weight.toFixed(1)}%</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {costBasis ? (
                      <div>
                        <div className="tabular-nums">${costBasis.toFixed(2)}</div>
                        {pnlPercent !== null && (
                          <div
                            className={`text-[10px] ${
                              pnlPercent >= 0 ? "text-positive" : "text-negative"
                            }`}
                          >
                            {pnlPercent >= 0 ? "+" : ""}
                            {pnlPercent.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(position.id)}
                      disabled={deletingId === position.id}
                    >
                      {deletingId === position.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      )}
                    </Button>
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
