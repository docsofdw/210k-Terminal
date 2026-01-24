"use client"

import { addToWatchlist } from "@/actions/watchlist"
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
import type { SelectCompany } from "@/db/schema/companies"
import { Loader2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface AddToWatchlistDialogProps {
  companies: SelectCompany[]
  existingCompanyIds: string[]
}

export function AddToWatchlistDialog({
  companies,
  existingCompanyIds
}: AddToWatchlistDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [companyId, setCompanyId] = useState("")
  const [notes, setNotes] = useState("")

  // Filter out companies already in watchlist
  const availableCompanies = companies.filter(
    c => !existingCompanyIds.includes(c.id)
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId) return

    setIsLoading(true)

    try {
      const result = await addToWatchlist(companyId, notes || undefined)

      if (result.isSuccess) {
        toast.success("Added to watchlist")
        setOpen(false)
        setCompanyId("")
        setNotes("")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to add to watchlist")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Company
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add to Watchlist</DialogTitle>
          <DialogDescription>
            Add a company to your personal watchlist.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {availableCompanies.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    All companies already in watchlist
                  </SelectItem>
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
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Your notes about this company"
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
              disabled={isLoading || !companyId || availableCompanies.length === 0}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add to Watchlist
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
