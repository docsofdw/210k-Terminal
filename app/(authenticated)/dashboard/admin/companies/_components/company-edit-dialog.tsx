"use client"

import { updateCompany, updateCompanyHoldings } from "@/actions/companies"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { SelectCompany } from "@/db/schema/companies"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface CompanyEditDialogProps {
  company: SelectCompany
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CompanyEditDialog({
  company,
  open,
  onOpenChange
}: CompanyEditDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: company.name,
    ticker: company.ticker,
    yahooTicker: company.yahooTicker,
    exchange: company.exchange,
    tradingCurrency: company.tradingCurrency,
    country: company.country,
    sector: company.sector || "",
    website: company.website || "",
    description: company.description || "",
    sharesOutstanding: company.sharesOutstanding || "",
    cashUsd: company.cashUsd || "",
    debtUsd: company.debtUsd || "",
    preferredsUsd: company.preferredsUsd || "",
    btcHoldings: company.btcHoldings || "",
    btcHoldingsSource: company.btcHoldingsSource || "",
    status: company.status,
    isTracked: company.isTracked
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await updateCompany(company.id, {
        name: formData.name,
        ticker: formData.ticker,
        yahooTicker: formData.yahooTicker,
        exchange: formData.exchange,
        tradingCurrency: formData.tradingCurrency as "USD" | "CAD" | "EUR" | "GBP" | "JPY" | "HKD" | "AUD" | "BRL" | "THB" | "KRW",
        country: formData.country,
        sector: formData.sector || null,
        website: formData.website || null,
        description: formData.description || null,
        sharesOutstanding: formData.sharesOutstanding || null,
        cashUsd: formData.cashUsd || null,
        debtUsd: formData.debtUsd || null,
        preferredsUsd: formData.preferredsUsd || null,
        btcHoldings: formData.btcHoldings || null,
        btcHoldingsSource: formData.btcHoldingsSource || null,
        status: formData.status as "active" | "inactive",
        isTracked: formData.isTracked
      })

      if (result.isSuccess) {
        toast.success("Company updated successfully")
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error || "Failed to update company")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Company</DialogTitle>
          <DialogDescription>
            Update company information. Changes will be logged.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker</Label>
              <Input
                id="ticker"
                value={formData.ticker}
                onChange={e => setFormData({ ...formData, ticker: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="yahooTicker">Yahoo Ticker</Label>
              <Input
                id="yahooTicker"
                value={formData.yahooTicker ?? ""}
                onChange={e => setFormData({ ...formData, yahooTicker: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exchange">Exchange</Label>
              <Input
                id="exchange"
                value={formData.exchange ?? ""}
                onChange={e => setFormData({ ...formData, exchange: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradingCurrency">Currency</Label>
              <Select
                value={formData.tradingCurrency ?? "USD"}
                onValueChange={value => setFormData({ ...formData, tradingCurrency: value as "USD" | "CAD" | "EUR" | "GBP" | "JPY" | "HKD" | "AUD" | "BRL" | "THB" | "KRW" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                  <SelectItem value="HKD">HKD</SelectItem>
                  <SelectItem value="AUD">AUD</SelectItem>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="THB">THB</SelectItem>
                  <SelectItem value="KRW">KRW</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country ?? ""}
                onChange={e => setFormData({ ...formData, country: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="btcHoldings">BTC Holdings</Label>
            <Input
              id="btcHoldings"
              type="number"
              step="0.00000001"
              value={formData.btcHoldings}
              onChange={e => setFormData({ ...formData, btcHoldings: e.target.value })}
              placeholder="0.00000000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="btcHoldingsSource">Holdings Source</Label>
            <Input
              id="btcHoldingsSource"
              value={formData.btcHoldingsSource}
              onChange={e => setFormData({ ...formData, btcHoldingsSource: e.target.value })}
              placeholder="e.g., 10-K filing, press release"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sharesOutstanding">Shares Outstanding</Label>
              <Input
                id="sharesOutstanding"
                type="number"
                value={formData.sharesOutstanding}
                onChange={e => setFormData({ ...formData, sharesOutstanding: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cashUsd">Cash (USD)</Label>
              <Input
                id="cashUsd"
                type="number"
                step="0.01"
                value={formData.cashUsd}
                onChange={e => setFormData({ ...formData, cashUsd: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="debtUsd">Debt (USD)</Label>
              <Input
                id="debtUsd"
                type="number"
                step="0.01"
                value={formData.debtUsd}
                onChange={e => setFormData({ ...formData, debtUsd: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={value => setFormData({ ...formData, status: value as "active" | "inactive" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="isTracked">Tracking</Label>
              <Select
                value={formData.isTracked ? "true" : "false"}
                onValueChange={value => setFormData({ ...formData, isTracked: value === "true" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Tracked</SelectItem>
                  <SelectItem value="false">Not Tracked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
