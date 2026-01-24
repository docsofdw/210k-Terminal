import {
  getAllCompanySnapshotsForDate,
  getAvailableSnapshotDates
} from "@/actions/snapshots"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/lib/auth/permissions"
import { History, Calendar } from "lucide-react"
import { DatePicker } from "./_components/date-picker"
import { SnapshotTable } from "./_components/snapshot-table"

interface HistoryPageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  await requireAuth()

  const params = await searchParams
  const availableDates = await getAvailableSnapshotDates()

  // Parse selected date from URL or use most recent
  let selectedDate: Date | undefined
  if (params.date) {
    selectedDate = new Date(params.date)
  } else if (availableDates.length > 0) {
    selectedDate = availableDates[0]
  }

  // Fetch snapshots for the selected date
  const snapshots = selectedDate
    ? await getAllCompanySnapshotsForDate(selectedDate)
    : []

  // Calculate summary stats
  const totalBtcHoldings = snapshots.reduce((sum, s) => {
    return sum + (s.btcHoldings ? parseFloat(s.btcHoldings) : 0)
  }, 0)

  const mNavValues = snapshots
    .filter(s => s.mNav)
    .map(s => parseFloat(s.mNav!))

  const avgMNav =
    mNavValues.length > 0
      ? mNavValues.reduce((a, b) => a + b, 0) / mNavValues.length
      : 0

  const btcPrice = snapshots[0]?.btcPrice
    ? parseFloat(snapshots[0].btcPrice)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <History className="h-6 w-6 text-terminal-orange" />
            Historical Snapshots
          </h1>
          <p className="text-xs text-muted-foreground">
            View the comps table at any point in time
          </p>
        </div>
        <DatePicker
          selectedDate={selectedDate}
          availableDates={availableDates}
        />
      </div>

      {availableDates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Snapshots Yet</h3>
            <p className="mt-2 text-muted-foreground">
              Historical snapshots will appear here once the daily snapshot cron runs.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              The cron runs at midnight UTC each day.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-sm border border-border/50 bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Snapshot Date
              </div>
              <div className="text-xl font-bold text-terminal-orange">
                {selectedDate?.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })}
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
                Avg mNAV
              </div>
              <div className="text-xl font-bold">{avgMNav.toFixed(2)}x</div>
            </div>
          </div>

          {/* Snapshot Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Comps Table Snapshot</CardTitle>
              <CardDescription>
                Company data as of{" "}
                {selectedDate?.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric"
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SnapshotTable snapshots={snapshots} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
