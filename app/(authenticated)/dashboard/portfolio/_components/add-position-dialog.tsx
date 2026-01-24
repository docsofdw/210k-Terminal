"use client"

import { createPosition } from "@/actions/portfolio"
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
import { Loader2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface AddPositionDialogProps {
  companies: SelectCompany[]
  existingCompanyIds: string[]
}

export function AddPositionDialog({
  companies,
  existingCompanyIds
}: AddPositionDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    companyId: "",
    shares: "",
    averageCostBasis: "",
    averageCostBasisUsd: "",
    notes: ""
  })

  // Filter out companies that already have positions
  const availableCompanies = companies.filter(
    c => !existingCompanyIds.includes(c.id)
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await createPosition({
        companyId: formData.companyId,
        shares: formData.shares,
        averageCostBasis: formData.averageCostBasis || null,
        averageCostBasisUsd: formData.averageCostBasisUsd || null,
        notes: formData.notes || null
      })

      if (result.isSuccess) {
        toast.success("Position added successfully")
        setOpen(false)
        setFormData({
          companyId: "",
          shares: "",
          averageCostBasis: "",
          averageCostBasisUsd: "",
          notes: ""
        })
        router.refresh()
      } else {
        toast.error(result.error || "Failed to add position")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const selectedCompany = companies.find(c => c.id === formData.companyId)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Position
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Position</DialogTitle>
          <DialogDescription>
            Add a new position to your portfolio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Select
              value={formData.companyId}
              onValueChange={value =>
                setFormData({ ...formData, companyId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {availableCompanies.length === 0 ? (
                  <div className="p-2 text-center text-xs text-muted-foreground">
                    All companies have positions
                  </div>
                ) : (
                  availableCompanies.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.ticker} - {company.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shares">Number of Shares</Label>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costBasis">
                Avg Cost ({selectedCompany?.tradingCurrency || "Local"})
              </Label>
              <Input
                id="costBasis"
                type="number"
                step="0.01"
                value={formData.averageCostBasis}
                onChange={e =>
                  setFormData({ ...formData, averageCostBasis: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costBasisUsd">Avg Cost (USD)</Label>
              <Input
                id="costBasisUsd"
                type="number"
                step="0.01"
                value={formData.averageCostBasisUsd}
                onChange={e =>
                  setFormData({
                    ...formData,
                    averageCostBasisUsd: e.target.value
                  })
                }
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={e =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Optional notes about this position"
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
              disabled={isLoading || !formData.companyId || !formData.shares}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Position
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
