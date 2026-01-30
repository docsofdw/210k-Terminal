import { getCompanySnapshotsByTicker, getRelativeValueScreenerData } from "@/actions/snapshots"
import { getAllCompanies } from "@/actions/companies"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireAuth } from "@/lib/auth/permissions"
import { TrendingUp, Building2, LineChart, Target } from "lucide-react"
import { DateRangeSelector } from "./_components/date-range-selector"
import { CompanySelector } from "./_components/company-selector"
import { CompanyMNavChart } from "./_components/company-mnav-chart"
import { CompanyPriceChart } from "./_components/company-price-chart"
import { RelativeValueScreener } from "./_components/screener/relative-value-screener"
import Link from "next/link"

interface ChartsPageProps {
  searchParams: Promise<{ days?: string; company?: string; tab?: string }>
}

export default async function ChartsPage({ searchParams }: ChartsPageProps) {
  await requireAuth()

  const params = await searchParams
  const daysParam = params.days
  const companyTicker = params.company || null
  const currentTab = params.tab || "screener"

  // Parse days: 0 means ALL (use a large number), default is 90
  const days = daysParam === "0" ? 3650 : (parseInt(daysParam || "90") || 90)

  const companies = await getAllCompanies()

  // Fetch company-specific data if a company is selected
  const companySnapshots = companyTicker
    ? await getCompanySnapshotsByTicker(companyTicker, days)
    : []

  // Fetch screener data only when on screener tab
  const screenerData = currentTab === "screener"
    ? await getRelativeValueScreenerData()
    : []

  const selectedCompany = companyTicker
    ? companies.find(c => c.ticker === companyTicker)
    : null

  // Build tab URLs preserving other params
  const buildTabUrl = (tab: string) => {
    const params = new URLSearchParams()
    if (daysParam) params.set("days", daysParam)
    if (companyTicker) params.set("company", companyTicker)
    params.set("tab", tab)
    return `?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Target className="h-6 w-6 text-terminal-orange" />
            Value Screener
          </h1>
          <p className="text-xs text-muted-foreground">
            Identify attractive valuations relative to historical norms
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanySelector
            companies={companies.map(c => ({ id: c.id, ticker: c.ticker, name: c.name }))}
            currentTicker={companyTicker}
          />
          <DateRangeSelector currentDays={days} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg border border-border/50 bg-muted/30 p-1">
        <Link
          href={buildTabUrl("screener")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            currentTab === "screener"
              ? "bg-background text-terminal-orange shadow-sm"
              : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
          }`}
        >
          <Target className="h-4 w-4" />
          Value Screener
        </Link>
        {selectedCompany && (
          <Link
            href={buildTabUrl("company")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              currentTab === "company"
                ? "bg-background text-terminal-orange shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            }`}
          >
            <Building2 className="h-4 w-4" />
            {selectedCompany.ticker}
          </Link>
        )}
      </div>

      {/* Value Screener Tab */}
      {currentTab === "screener" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-terminal-orange" />
              Relative Value Screener
            </CardTitle>
            <CardDescription>
              Identify treasury companies trading at attractive valuations relative to historical norms and peers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RelativeValueScreener data={screenerData} />
          </CardContent>
        </Card>
      )}

      {/* Company Analysis Tab */}
      {currentTab === "company" && (
        <>
          {selectedCompany ? (
            <>
              {/* Company Summary */}
              <div className="rounded-lg border border-border/50 bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-terminal-orange/10">
                    <Building2 className="h-6 w-6 text-terminal-orange" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{selectedCompany.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedCompany.ticker} · {selectedCompany.tradingCurrency ?? "USD"}
                    </p>
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-terminal-orange" />
                    mNAV History
                  </CardTitle>
                  <CardDescription>
                    Historical mNAV (market price to NAV ratio) for {selectedCompany.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CompanyMNavChart
                    data={companySnapshots}
                    companyName={selectedCompany.name}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5 text-blue-500" />
                    Stock Price History
                  </CardTitle>
                  <CardDescription>
                    Historical stock price in {selectedCompany.tradingCurrency ?? "USD"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CompanyPriceChart
                    data={companySnapshots}
                    companyName={selectedCompany.name}
                    currency={selectedCompany.tradingCurrency ?? "USD"}
                  />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Select a Company</h3>
                <p className="mt-2 text-muted-foreground">
                  Use the company selector above to view detailed analytics for a specific treasury company.
                </p>
                <p className="mt-4 text-xs text-muted-foreground">
                  Available companies: {companies.slice(0, 5).map(c => c.ticker).join(", ")}
                  {companies.length > 5 && ` and ${companies.length - 5} more`}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
