"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

interface Company {
  id: string
  ticker: string
  name: string
}

interface CompanySelectorProps {
  companies: Company[]
  currentTicker: string | null
}

export function CompanySelector({ companies, currentTicker }: CompanySelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleCompanyChange = useCallback(
    (ticker: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (ticker === "all") {
        params.delete("company")
      } else {
        params.set("company", ticker)
      }
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  return (
    <Select value={currentTicker || "all"} onValueChange={handleCompanyChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select company" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Companies (Aggregate)</SelectItem>
        {companies.map(company => (
          <SelectItem key={company.id} value={company.ticker}>
            {company.ticker} - {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
