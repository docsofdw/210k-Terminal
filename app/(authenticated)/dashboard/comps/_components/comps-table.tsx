"use client"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { SelectCompany } from "@/db/schema/companies"
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X, Info, Briefcase } from "lucide-react"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"

// Formula tooltips for column headers
const COLUMN_FORMULAS: Record<string, { label: string; formula: string; description: string }> = {
  dilutedMNav: {
    label: "Diluted mNAV",
    formula: "Diluted EV ÷ BTC NAV",
    description: "Multiple to Net Asset Value. Shows how much premium/discount the stock trades at relative to its Bitcoin holdings. <1x = discount, >1x = premium."
  },
  priceAt1xDilutedMNav: {
    label: "1x D.mNAV Price",
    formula: "Current Price ÷ Diluted mNAV",
    description: "The theoretical stock price if the company traded at exactly 1x diluted mNAV (fair value based on BTC holdings)."
  },
  enterpriseValueUsd: {
    label: "Enterprise Value",
    formula: "Market Cap + Debt - Cash",
    description: "Total company value including debt obligations minus cash. Represents what it would cost to acquire the entire business."
  },
  btcNavUsd: {
    label: "BTC NAV",
    formula: "BTC Holdings × BTC Price",
    description: "Net Asset Value of Bitcoin holdings. The USD value of all Bitcoin held by the company at current market prices."
  },
  dilutedShares: {
    label: "Diluted Shares",
    formula: "Basic Shares + Options + Warrants + Convertibles",
    description: "Fully diluted share count. Includes all shares that could be created from stock options, warrants, and convertible securities."
  },
  avgVolumeUsd: {
    label: "Avg Volume",
    formula: "Avg Daily Volume × Stock Price",
    description: "Average daily trading volume in USD. Indicates liquidity and how easily shares can be bought or sold."
  }
}

interface CompsTableProps {
  companies: SelectCompany[]
  portfolioCompanyIds?: string[]
}

type SortField =
  | "rank"
  | "name"
  | "btcHoldings"
  | "price"
  | "marketCapUsd"
  | "dilutedMNav"
  | "priceAt1xDilutedMNav"
  | "enterpriseValueUsd"
  | "btcNavUsd"
  | "debtUsd"
  | "avgVolumeUsd"
  | "sharesOutstanding"
  | "dilutedShares"
  | "priceChange1d"

type SortDirection = "asc" | "desc"

function formatNumber(
  value: number | string | null | undefined,
  options: {
    decimals?: number
    style?: "decimal" | "currency" | "percent"
    currency?: string
    compact?: boolean
  } = {}
): string {
  if (value === null || value === undefined) return "-"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "-"

  const { decimals = 2, style = "decimal", currency = "USD", compact } = options

  if (compact) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: decimals
    }).format(num)
  }

  if (style === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  if (style === "percent") {
    return `${num >= 0 ? "+" : ""}${num.toFixed(decimals)}%`
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num)
}

function formatBtc(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "-"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "-"
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(num)
}

function formatMNav(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "-"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "-"
  return `${num.toFixed(2)}x`
}

function getMNavColor(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "text-muted-foreground"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "text-muted-foreground"
  if (num > 2) return "text-red-500"
  if (num > 1.5) return "text-orange-500"
  if (num > 1) return "text-yellow-500"
  if (num < 0.8) return "text-green-500"
  if (num < 1) return "text-emerald-400"
  return "text-muted-foreground"
}

function getChangeColor(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "text-muted-foreground"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "text-muted-foreground"
  if (num > 0) return "text-green-500"
  if (num < 0) return "text-red-500"
  return "text-muted-foreground"
}

// Sortable header with optional formula tooltip
function SortableHeader({
  field,
  label,
  sortField,
  sortDirection,
  onSort,
  formulaKey,
  className = ""
}: {
  field: SortField
  label: string
  sortField: SortField
  sortDirection: SortDirection
  onSort: (field: SortField) => void
  formulaKey?: keyof typeof COLUMN_FORMULAS
  className?: string
}) {
  const getSortIcon = () => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" />
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    )
  }

  const formula = formulaKey ? COLUMN_FORMULAS[formulaKey] : null

  if (formula) {
    return (
      <TableHead
        className={`cursor-pointer hover:bg-muted/50 whitespace-nowrap py-2 px-2 ${className}`}
        onClick={() => onSort(field)}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-0.5">
              {label}
              <Info className="h-2.5 w-2.5 text-muted-foreground/50" />
              {getSortIcon()}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px] text-left">
            <div className="space-y-1.5">
              <div className="font-semibold">{formula.label}</div>
              <div className="font-mono text-[11px] bg-background/20 px-1.5 py-0.5 rounded">
                {formula.formula}
              </div>
              <div className="text-[11px] opacity-90">{formula.description}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TableHead>
    )
  }

  return (
    <TableHead
      className={`cursor-pointer hover:bg-muted/50 whitespace-nowrap py-2 px-2 ${className}`}
      onClick={() => onSort(field)}
    >
      {label} {getSortIcon()}
    </TableHead>
  )
}

export function CompsTable({ companies, portfolioCompanyIds = [] }: CompsTableProps) {
  const [sortField, setSortField] = useState<SortField>("btcHoldings")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [portfolioFilter, setPortfolioFilter] = useState<string>("all")

  // Create a Set for O(1) lookup of portfolio companies
  const portfolioCompanySet = useMemo(
    () => new Set(portfolioCompanyIds),
    [portfolioCompanyIds]
  )

  // Check if a company is in the portfolio
  const isInPortfolio = (companyId: string) => portfolioCompanySet.has(companyId)

  // Extract unique categories and regions for filter options
  const filterOptions = useMemo(() => {
    const categories = [...new Set(companies.map(c => c.category).filter(Boolean))].sort()
    const regions = [...new Set(companies.map(c => c.region).filter(Boolean))].sort()
    return { categories, regions }
  }, [companies])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }


  // Apply filters
  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = company.name.toLowerCase().includes(query)
        const matchesTicker = company.ticker.toLowerCase().includes(query)
        if (!matchesName && !matchesTicker) return false
      }

      // Category filter
      if (categoryFilter !== "all" && company.category !== categoryFilter) {
        return false
      }

      // Region filter
      if (regionFilter !== "all" && company.region !== regionFilter) {
        return false
      }

      // Portfolio filter
      if (portfolioFilter === "portfolio" && !isInPortfolio(company.id)) {
        return false
      }

      return true
    })
  }, [companies, searchQuery, categoryFilter, regionFilter, portfolioFilter, isInPortfolio])

  const sortedCompanies = useMemo(() => {
    return [...filteredCompanies].sort((a, b) => {
      let comparison = 0
      const getNum = (val: string | number | null | undefined) => {
        if (val === null || val === undefined) return 0
        return typeof val === "string" ? parseFloat(val) || 0 : val
      }

      switch (sortField) {
        case "rank":
          comparison = getNum(a.rank) - getNum(b.rank)
          break
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "btcHoldings":
          comparison = getNum(a.btcHoldings) - getNum(b.btcHoldings)
          break
        case "price":
          comparison = getNum(a.price) - getNum(b.price)
          break
        case "marketCapUsd":
          comparison = getNum(a.marketCapUsd) - getNum(b.marketCapUsd)
          break
        case "dilutedMNav":
          comparison = getNum(a.dilutedMNav) - getNum(b.dilutedMNav)
          break
        case "priceAt1xDilutedMNav":
          comparison = getNum(a.priceAt1xDilutedMNav) - getNum(b.priceAt1xDilutedMNav)
          break
        case "enterpriseValueUsd":
          comparison = getNum(a.enterpriseValueUsd) - getNum(b.enterpriseValueUsd)
          break
        case "btcNavUsd":
          comparison = getNum(a.btcNavUsd) - getNum(b.btcNavUsd)
          break
        case "debtUsd":
          comparison = getNum(a.debtUsd) - getNum(b.debtUsd)
          break
        case "avgVolumeUsd":
          comparison = getNum(a.avgVolumeUsd) - getNum(b.avgVolumeUsd)
          break
        case "sharesOutstanding":
          comparison = getNum(a.sharesOutstanding) - getNum(b.sharesOutstanding)
          break
        case "dilutedShares":
          comparison = getNum(a.dilutedShares) - getNum(b.dilutedShares)
          break
        case "priceChange1d":
          comparison = getNum(a.priceChange1d) - getNum(b.priceChange1d)
          break
      }

      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [filteredCompanies, sortField, sortDirection])

  const hasActiveFilters = searchQuery || categoryFilter !== "all" || regionFilter !== "all" || portfolioFilter !== "all"

  const clearFilters = () => {
    setSearchQuery("")
    setCategoryFilter("all")
    setRegionFilter("all")
    setPortfolioFilter("all")
  }

  // Count portfolio companies for the filter label
  const portfolioCount = companies.filter(c => isInPortfolio(c.id)).length

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or ticker..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {filterOptions.categories.map(category => (
              <SelectItem key={category} value={category!}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {filterOptions.regions.map(region => (
              <SelectItem key={region} value={region!}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {portfolioCompanyIds.length > 0 && (
          <Select value={portfolioFilter} onValueChange={setPortfolioFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Portfolio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              <SelectItem value="portfolio">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="h-3 w-3 text-terminal-orange" />
                  210k Portfolio ({portfolioCount})
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}

        <div className="ml-auto text-sm text-muted-foreground">
          {sortedCompanies.length} of {companies.length} companies
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <SortableHeader
                field="name"
                label="Company"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <TableHead className="text-right whitespace-nowrap py-2 px-2">Ticker</TableHead>
              <SortableHeader
                field="btcHoldings"
                label="BTC"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                field="price"
                label="Price"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                field="priceChange1d"
                label="1D"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                field="marketCapUsd"
                label="MktCap"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                field="dilutedMNav"
                label="D. mNAV"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                formulaKey="dilutedMNav"
                className="text-right"
              />
              <SortableHeader
                field="priceAt1xDilutedMNav"
                label="1x D.mNAV"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                formulaKey="priceAt1xDilutedMNav"
                className="text-right"
              />
              <SortableHeader
                field="enterpriseValueUsd"
                label="EV"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                formulaKey="enterpriseValueUsd"
                className="text-right"
              />
              <SortableHeader
                field="btcNavUsd"
                label="NAV"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                formulaKey="btcNavUsd"
                className="text-right"
              />
              <SortableHeader
                field="debtUsd"
                label="Debt"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                field="sharesOutstanding"
                label="Shr"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                field="dilutedShares"
                label="DilShr"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                formulaKey="dilutedShares"
                className="text-right"
              />
              <SortableHeader
                field="avgVolumeUsd"
                label="Vol"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                formulaKey="avgVolumeUsd"
                className="text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCompanies.map(company => (
              <TableRow key={company.id} className="h-7">
                <TableCell className="py-1 px-2 max-w-[150px]">
                  <div className="flex items-center gap-1.5">
                    {isInPortfolio(company.id) && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Briefcase className="h-3 w-3 text-terminal-orange flex-shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          In 210k Portfolio
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <span className="truncate font-medium" title={company.name}>
                      {company.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-1 px-2 text-muted-foreground">
                  {company.ticker}
                </TableCell>
                <TableCell className="py-1 px-2 text-right font-mono tabular-nums">
                  {formatBtc(company.btcHoldings)}
                </TableCell>
                <TableCell className="py-1 px-2 text-right font-mono tabular-nums">
                  {formatNumber(company.price, { decimals: 2 })}
                </TableCell>
                <TableCell className={`py-1 px-2 text-right font-mono tabular-nums ${getChangeColor(company.priceChange1d)}`}>
                  {formatNumber(company.priceChange1d, { style: "percent", decimals: 1 })}
                </TableCell>
                <TableCell className="py-1 px-2 text-right font-mono tabular-nums">
                  {formatNumber(company.marketCapUsd, { compact: true, decimals: 1 })}
                </TableCell>
                <TableCell className={`py-1 px-2 text-right font-mono tabular-nums font-semibold ${getMNavColor(company.dilutedMNav)}`}>
                  {formatMNav(company.dilutedMNav)}
                </TableCell>
                <TableCell className="py-1 px-2 text-right font-mono tabular-nums text-emerald-500">
                  {formatNumber(company.priceAt1xDilutedMNav, { decimals: 2 })}
                </TableCell>
                <TableCell className="py-1 px-2 text-right font-mono tabular-nums">
                  {formatNumber(company.enterpriseValueUsd, { compact: true, decimals: 1 })}
                </TableCell>
                <TableCell className="py-1 px-2 text-right font-mono tabular-nums">
                  {formatNumber(company.btcNavUsd, { compact: true, decimals: 1 })}
                </TableCell>
                <TableCell className="py-1 px-2 text-right font-mono tabular-nums">
                  {formatNumber(company.debtUsd, { compact: true, decimals: 1 })}
                </TableCell>
                <TableCell className="py-1 px-2 text-right font-mono tabular-nums">
                  {formatNumber(company.sharesOutstanding, { compact: true, decimals: 0 })}
                </TableCell>
                <TableCell className="py-1 px-2 text-right font-mono tabular-nums">
                  {formatNumber(company.dilutedShares, { compact: true, decimals: 0 })}
                </TableCell>
                <TableCell className="py-1 px-2 text-right font-mono tabular-nums">
                  {formatNumber(company.avgVolumeUsd, { compact: true, decimals: 0 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
