import { getAllCompanies } from "@/actions/companies"
import { getLatestBtcPrice } from "@/actions/market-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber } from "@/lib/calculations"
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bitcoin,
  Building2,
  TrendingUp,
  Wallet
} from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  const [companies, btcPriceData] = await Promise.all([
    getAllCompanies(),
    getLatestBtcPrice()
  ])

  const btcPrice = btcPriceData ? Number(btcPriceData.priceUsd) : 100000
  const btcChange = btcPriceData ? Number(btcPriceData.change24h) || 0 : 0

  const totalBtcHoldings = companies.reduce(
    (sum, c) => sum + (Number(c.btcHoldings) || 0),
    0
  )
  const totalBtcValue = totalBtcHoldings * btcPrice

  // Get top 5 companies by BTC holdings
  const topCompanies = [...companies]
    .sort((a, b) => (Number(b.btcHoldings) || 0) - (Number(a.btcHoldings) || 0))
    .slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <TrendingUp className="h-8 w-8 text-muted-foreground" />
          210k Terminal
        </h1>
        <p className="text-muted-foreground">Bitcoin treasury analytics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">BTC Price</CardTitle>
            <Bitcoin className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(btcPrice, {
                style: "currency",
                currency: "USD",
                decimals: 0
              })}
            </div>
            <p
              className={`text-xs ${btcChange >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              {btcChange >= 0 ? "+" : ""}
              {formatNumber(btcChange, { decimals: 2 })}% (24h)
            </p>
          </CardContent>
        </Card>

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
              {formatNumber(totalBtcHoldings, { decimals: 0, compact: true })}
            </div>
            <p className="text-xs text-muted-foreground">
              ≈{" "}
              {formatNumber(totalBtcValue, {
                style: "currency",
                currency: "USD",
                compact: true
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">% of Supply</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber((totalBtcHoldings / 21_000_000) * 100, {
                decimals: 2
              })}
              %
            </div>
            <p className="text-xs text-muted-foreground">
              Of 21M BTC max supply
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links & Top Companies */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Link
              href="/dashboard/comps"
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Comps Table</p>
                  <p className="text-sm text-muted-foreground">
                    Compare treasury companies
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href="/dashboard/portfolio"
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Portfolio</p>
                  <p className="text-sm text-muted-foreground">
                    Track your positions
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href="/dashboard/charts"
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Charts</p>
                  <p className="text-sm text-muted-foreground">
                    Historical analysis
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href="/dashboard/alerts"
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Price notifications
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        {/* Top Companies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top BTC Holdings</CardTitle>
            <Link
              href="/dashboard/comps"
              className="text-sm text-muted-foreground hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCompanies.map((company, index) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{company.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {company.ticker}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-medium">
                      {formatNumber(Number(company.btcHoldings) || 0, {
                        decimals: 0
                      })}{" "}
                      BTC
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber((Number(company.btcHoldings) || 0) * btcPrice, {
                        style: "currency",
                        currency: "USD",
                        compact: true
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {topCompanies.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="mx-auto h-8 w-8 mb-2" />
                  <p>No companies tracked yet</p>
                  <p className="text-sm">Run the seed script to add data</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
