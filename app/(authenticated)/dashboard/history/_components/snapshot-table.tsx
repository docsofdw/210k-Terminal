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
import type { SelectDailySnapshot } from "@/db/schema/daily-snapshots"

interface SnapshotTableProps {
  snapshots: SelectDailySnapshot[]
}

export function SnapshotTable({ snapshots }: SnapshotTableProps) {
  if (snapshots.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>No snapshot data available for this date.</p>
      </div>
    )
  }

  return (
    <div className="rounded-sm border border-border/50">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticker</TableHead>
            <TableHead>Company</TableHead>
            <TableHead className="text-right">Price (USD)</TableHead>
            <TableHead className="text-right">BTC Holdings</TableHead>
            <TableHead className="text-right">BTC NAV</TableHead>
            <TableHead className="text-right">Mkt Cap</TableHead>
            <TableHead className="text-right">EV</TableHead>
            <TableHead className="text-right">mNAV</TableHead>
            <TableHead className="text-right">Sats/Share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {snapshots.map(snapshot => {
            const stockPriceUsd = snapshot.stockPriceUsd
              ? parseFloat(snapshot.stockPriceUsd)
              : null
            const btcHoldings = snapshot.btcHoldings
              ? parseFloat(snapshot.btcHoldings)
              : null
            const btcNav = snapshot.btcNav
              ? parseFloat(snapshot.btcNav)
              : null
            const marketCapUsd = snapshot.marketCapUsd
              ? parseFloat(snapshot.marketCapUsd)
              : null
            const evUsd = snapshot.evUsd
              ? parseFloat(snapshot.evUsd)
              : null
            const mNav = snapshot.mNav
              ? parseFloat(snapshot.mNav)
              : null
            const satsPerShare = snapshot.satsPerShare
              ? parseFloat(snapshot.satsPerShare)
              : null

            return (
              <TableRow key={snapshot.id}>
                <TableCell>
                  <div className="font-medium">{snapshot.ticker}</div>
                  {snapshot.dataSource === "google_sheets" && (
                    <Badge variant="outline" className="text-[8px]">
                      Sheet
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-[150px] truncate text-muted-foreground">
                  {snapshot.companyName}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {stockPriceUsd !== null
                    ? `$${stockPriceUsd.toFixed(2)}`
                    : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-terminal-orange">
                  {btcHoldings !== null
                    ? btcHoldings.toLocaleString(undefined, {
                        maximumFractionDigits: 0
                      })
                    : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {btcNav !== null
                    ? `$${(btcNav / 1_000_000).toFixed(1)}M`
                    : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {marketCapUsd !== null
                    ? `$${(marketCapUsd / 1_000_000).toFixed(1)}M`
                    : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {evUsd !== null
                    ? `$${(evUsd / 1_000_000).toFixed(1)}M`
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {mNav !== null ? (
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
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {satsPerShare !== null
                    ? satsPerShare.toLocaleString(undefined, {
                        maximumFractionDigits: 0
                      })
                    : "-"}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
