"use client"

import { createTransaction } from "@/actions/portfolio"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
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
import type { SelectPortfolioPosition } from "@/db/schema/portfolio-positions"
import { Loader2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface AddTransactionDialogProps {
  companies: SelectCompany[]
  positions: {
    position: SelectPortfolioPosition
    company: SelectCompany
  }[]
  btcPrice?: number
}

export function AddTransactionDialog({
  companies,
  positions,
  btcPrice = 0
}: AddTransactionDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    companyId: "",
    positionId: "",
    type: "buy" as "buy" | "sell",
    shares: "",
    pricePerShare: "",
    pricePerShareUsd: "",
    fees: "",
    transactionDate: new Date().toISOString().split("T")[0],
    notes: ""
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const shares = parseFloat(formData.shares)
      const pricePerShare = parseFloat(formData.pricePerShare)
      const totalValue = shares * pricePerShare
      const pricePerShareUsd = formData.pricePerShareUsd
        ? parseFloat(formData.pricePerShareUsd)
        : pricePerShare
      const totalValueUsd = shares * pricePerShareUsd
      const totalValueBtc = btcPrice > 0 ? totalValueUsd / btcPrice : 0

      const result = await createTransaction({
        companyId: formData.companyId,
        positionId: formData.positionId || null,
        type: formData.type,
        shares: formData.shares,
        pricePerShare: formData.pricePerShare,
        pricePerShareUsd: pricePerShareUsd.toString(),
        totalValue: totalValue.toString(),
        totalValueUsd: totalValueUsd.toString(),
        btcPriceUsd: btcPrice.toString(),
        totalValueBtc: totalValueBtc.toString(),
        fees: formData.fees || null,
        feesUsd: formData.fees || null,
        transactionDate: new Date(formData.transactionDate),
        notes: formData.notes || null
      })

      if (result.isSuccess) {
        toast.success("Transaction added successfully")
        setOpen(false)
        setFormData({
          companyId: "",
          positionId: "",
          type: "buy",
          shares: "",
          pricePerShare: "",
          pricePerShareUsd: "",
          fees: "",
          transactionDate: new Date().toISOString().split("T")[0],
          notes: ""
        })
        router.refresh()
      } else {
        toast.error(result.error || "Failed to add transaction")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const selectedCompany = companies.find(c => c.id === formData.companyId)
  const matchingPosition = positions.find(
    p => p.company.id === formData.companyId
  )

  // Auto-link to position if exists
  if (matchingPosition && !formData.positionId) {
    setFormData(prev => ({
      ...prev,
      positionId: matchingPosition.position.id
    }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Record a buy or sell transaction.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={value =>
                  setFormData({ ...formData, type: value as "buy" | "sell" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.transactionDate}
                onChange={e =>
                  setFormData({ ...formData, transactionDate: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Select
              value={formData.companyId}
              onValueChange={value =>
                setFormData({ ...formData, companyId: value, positionId: "" })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.ticker} - {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shares">Shares</Label>
              <Input
                id="shares"
                type="number"
                step="0.00000001"
                value={formData.shares}
                onChange={e =>
                  setFormData({ ...formData, shares: e.target.value })
                }
                placeholder="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">
                Price ({selectedCompany?.tradingCurrency || "Local"})
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.pricePerShare}
                onChange={e =>
                  setFormData({ ...formData, pricePerShare: e.target.value })
                }
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priceUsd">Price (USD)</Label>
              <Input
                id="priceUsd"
                type="number"
                step="0.01"
                value={formData.pricePerShareUsd}
                onChange={e =>
                  setFormData({ ...formData, pricePerShareUsd: e.target.value })
                }
                placeholder="Same as local"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fees">Fees (USD)</Label>
              <Input
                id="fees"
                type="number"
                step="0.01"
                value={formData.fees}
                onChange={e =>
                  setFormData({ ...formData, fees: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
          </div>

          {btcPrice > 0 && formData.shares && formData.pricePerShare && (
            <div className="rounded-sm border border-border/50 bg-muted/30 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Value:</span>
                <span className="font-medium">
                  $
                  {(
                    parseFloat(formData.shares) *
                    parseFloat(formData.pricePerShareUsd || formData.pricePerShare)
                  ).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">BTC Value:</span>
                <span className="font-medium text-terminal-orange">
                  {(
                    (parseFloat(formData.shares) *
                      parseFloat(formData.pricePerShareUsd || formData.pricePerShare)) /
                    btcPrice
                  ).toFixed(6)}{" "}
                  BTC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">BTC Price:</span>
                <span className="font-medium">${btcPrice.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={e =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Optional notes"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !formData.companyId ||
                !formData.shares ||
                !formData.pricePerShare
              }
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
