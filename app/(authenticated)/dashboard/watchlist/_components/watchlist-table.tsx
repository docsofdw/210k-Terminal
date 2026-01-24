"use client"

import { removeFromWatchlist } from "@/actions/watchlist"
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
import type { SelectWatchlistItem } from "@/db/schema/watchlist"
import { Loader2, Trash2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface WatchlistTableProps {
  items: {
    watchlistItem: SelectWatchlistItem
    company: SelectCompany
  }[]
  btcPrice: number
  stockPrices: Record<string, number>
}

export function WatchlistTable({
  items,
  btcPrice,
  stockPrices
}: WatchlistTableProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleRemove(id: string) {
    setDeletingId(id)
    try {
      const result = await removeFromWatchlist(id)
      if (result.isSuccess) {
        toast.success("Removed from watchlist")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to remove")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setDeletingId(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>Your watchlist is empty. Add companies to track them here.</p>
      </div>
    )
  }

  return (
    <div className="rounded-sm border border-border/50">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">BTC Holdings</TableHead>
            <TableHead className="text-right">mNAV</TableHead>
            <TableHead className="text-right">Sats/Share</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(({ watchlistItem, company }) => {
            const stockPrice = stockPrices[company.id] || 0
            const btcHoldings = company.btcHoldings
              ? parseFloat(company.btcHoldings)
              : 0
            const sharesOutstanding = company.sharesOutstanding
              ? parseFloat(company.sharesOutstanding)
              : 0
            const cashUsd = company.cashUsd ? parseFloat(company.cashUsd) : 0
            const debtUsd = company.debtUsd ? parseFloat(company.debtUsd) : 0
            const preferredsUsd = company.preferredsUsd
              ? parseFloat(company.preferredsUsd)
              : 0

            // Calculate metrics
            const marketCapUsd = stockPrice * sharesOutstanding
            const btcNav = btcHoldings * btcPrice
            const evUsd = marketCapUsd + debtUsd + preferredsUsd - cashUsd
            const mNav = btcNav > 0 ? evUsd / btcNav : 0
            const satsPerShare =
              sharesOutstanding > 0
                ? (btcHoldings * 100_000_000) / sharesOutstanding
                : 0

            return (
              <TableRow key={watchlistItem.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{company.ticker}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {company.name}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${stockPrice.toFixed(2)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-terminal-orange">
                  {btcHoldings.toLocaleString(undefined, {
                    maximumFractionDigits: 0
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={
                      mNav > 1.5
                        ? "text-negative"
                        : mNav < 1
                          ? "text-positive"
                          : ""
                    }
                  >
                    {mNav.toFixed(2)}x
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {satsPerShare.toLocaleString(undefined, {
                    maximumFractionDigits: 0
                  })}
                </TableCell>
                <TableCell className="max-w-[150px] truncate text-muted-foreground">
                  {watchlistItem.notes || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/comps?ticker=${company.ticker}`}>
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(watchlistItem.id)}
                      disabled={deletingId === watchlistItem.id}
                    >
                      {deletingId === watchlistItem.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
