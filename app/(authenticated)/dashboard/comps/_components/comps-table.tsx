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
import {
  calculateMetrics,
  formatBtc,
  formatMNav,
  formatNumber,
  formatPremiumDiscount,
  formatSats,
  getMNavColor,
  getPremiumDiscountColor,
  type CompanyMetrics
} from "@/lib/calculations"
import { SelectCompany } from "@/db/schema/companies"
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useState, useMemo } from "react"

interface CompsTableProps {
  companies: SelectCompany[]
  btcPrice: number
  stockPrices: Map<string, number>
  fxRates: Map<string, number>
}

type SortField =
  | "name"
  | "btcHoldings"
  | "mNav"
  | "marketCap"
  | "satsPerShare"
  | "premiumDiscount"
type SortDirection = "asc" | "desc"

export function CompsTable({
  companies,
  btcPrice,
  stockPrices,
  fxRates
}: CompsTableProps) {
  const [sortField, setSortField] = useState<SortField>("btcHoldings")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 inline h-4 w-4 opacity-50" />
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline h-4 w-4" />
    ) : (
      <ArrowDown className="ml-1 inline h-4 w-4" />
    )
  }

  const companiesWithMetrics = useMemo(() => {
    return companies.map(company => {
      const stockPrice = stockPrices.get(company.id) || 0
      const fxRate =
        company.tradingCurrency === "USD"
          ? 1
          : fxRates.get(company.tradingCurrency) || 1
      const stockPriceUsd = stockPrice / fxRate

      const sharesOutstanding = Number(company.sharesOutstanding) || 0
      const marketCapUsd = stockPriceUsd * sharesOutstanding

      const metricsInput: CompanyMetrics = {
        btcHoldings: Number(company.btcHoldings) || 0,
        btcPrice,
        stockPrice: stockPriceUsd,
        sharesOutstanding,
        marketCapUsd,
        cashUsd: Number(company.cashUsd) || 0,
        debtUsd: Number(company.debtUsd) || 0,
        preferredsUsd: Number(company.preferredsUsd) || 0,
        tradingCurrency: company.tradingCurrency,
        fxRate
      }

      const metrics = calculateMetrics(metricsInput)

      return {
        company,
        stockPrice,
        stockPriceUsd,
        marketCapUsd,
        ...metrics
      }
    })
  }, [companies, btcPrice, stockPrices, fxRates])

  const sortedCompanies = useMemo(() => {
    return [...companiesWithMetrics].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case "name":
          comparison = a.company.name.localeCompare(b.company.name)
          break
        case "btcHoldings":
          comparison =
            Number(a.company.btcHoldings) - Number(b.company.btcHoldings)
          break
        case "mNav":
          comparison = a.mNav - b.mNav
          break
        case "marketCap":
          comparison = a.marketCapUsd - b.marketCapUsd
          break
        case "satsPerShare":
          comparison = a.satsPerShare - b.satsPerShare
          break
        case "premiumDiscount":
          comparison = a.premiumDiscount - b.premiumDiscount
          break
      }

      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [companiesWithMetrics, sortField, sortDirection])

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("name")}
            >
              Company {getSortIcon("name")}
            </TableHead>
            <TableHead className="text-right">Ticker</TableHead>
            <TableHead
              className="cursor-pointer text-right hover:bg-muted/50"
              onClick={() => handleSort("btcHoldings")}
            >
              BTC Holdings {getSortIcon("btcHoldings")}
            </TableHead>
            <TableHead className="text-right">Stock Price</TableHead>
            <TableHead
              className="cursor-pointer text-right hover:bg-muted/50"
              onClick={() => handleSort("marketCap")}
            >
              Market Cap {getSortIcon("marketCap")}
            </TableHead>
            <TableHead
              className="cursor-pointer text-right hover:bg-muted/50"
              onClick={() => handleSort("mNav")}
            >
              mNAV {getSortIcon("mNav")}
            </TableHead>
            <TableHead
              className="cursor-pointer text-right hover:bg-muted/50"
              onClick={() => handleSort("premiumDiscount")}
            >
              Premium {getSortIcon("premiumDiscount")}
            </TableHead>
            <TableHead
              className="cursor-pointer text-right hover:bg-muted/50"
              onClick={() => handleSort("satsPerShare")}
            >
              Sats/Share {getSortIcon("satsPerShare")}
            </TableHead>
            <TableHead className="text-right">BTC NAV</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCompanies.map(item => (
            <TableRow key={item.company.id}>
              <TableCell>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.company.name}</span>
                    {item.company.website && (
                      <Link
                        href={item.company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.company.sector} · {item.company.country}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="outline">{item.company.ticker}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatBtc(Number(item.company.btcHoldings) || 0, 0)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {item.company.tradingCurrency !== "USD" && (
                  <span className="text-muted-foreground text-xs">
                    {item.company.tradingCurrency}{" "}
                  </span>
                )}
                {formatNumber(item.stockPrice, {
                  style: "currency",
                  currency: item.company.tradingCurrency,
                  decimals: 2
                })}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatNumber(item.marketCapUsd, {
                  style: "currency",
                  currency: "USD",
                  compact: true
                })}
              </TableCell>
              <TableCell
                className={`text-right font-mono font-semibold ${getMNavColor(item.mNav)}`}
              >
                {formatMNav(item.mNav)}
              </TableCell>
              <TableCell
                className={`text-right font-mono ${getPremiumDiscountColor(item.premiumDiscount)}`}
              >
                {formatPremiumDiscount(item.premiumDiscount)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatSats(item.satsPerShare)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatNumber(item.btcNav, {
                  style: "currency",
                  currency: "USD",
                  compact: true
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
