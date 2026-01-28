"use client"

import { createAlert } from "@/actions/alerts"
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

interface AddAlertDialogProps {
  companies: SelectCompany[]
}

const alertTypes = [
  { value: "price_above", label: "Price Above" },
  { value: "price_below", label: "Price Below" },
  { value: "mnav_above", label: "mNAV Above" },
  { value: "mnav_below", label: "mNAV Below" },
  { value: "btc_holdings", label: "BTC Holdings Change" },
  { value: "pct_change_up", label: "% Change Up" },
  { value: "pct_change_down", label: "% Change Down" }
]

export function AddAlertDialog({ companies }: AddAlertDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    companyId: "",
    type: "price_above",
    threshold: "",
    thresholdPercent: "",
    channel: "telegram",
    telegramChatId: "",
    webhookUrl: "",
    isRepeating: true,
    cooldownMinutes: "60",
    description: ""
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const isPercentAlert = formData.type.includes("pct_change")

      const result = await createAlert({
        name: formData.name || null,
        companyId: formData.companyId || null,
        type: formData.type as "price_above" | "price_below" | "mnav_above" | "mnav_below" | "btc_holdings" | "pct_change_up" | "pct_change_down",
        threshold: !isPercentAlert && formData.threshold ? formData.threshold : null,
        thresholdPercent: isPercentAlert && formData.thresholdPercent ? formData.thresholdPercent : null,
        channel: formData.channel as "telegram" | "slack" | "email",
        telegramChatId: formData.channel === "telegram" ? formData.telegramChatId || null : null,
        webhookUrl: formData.channel === "slack" ? formData.webhookUrl || null : null,
        isRepeating: formData.isRepeating,
        cooldownMinutes: formData.cooldownMinutes || null,
        description: formData.description || null
      })

      if (result.isSuccess) {
        toast.success("Alert created successfully")
        setOpen(false)
        setFormData({
          name: "",
          companyId: "",
          type: "price_above",
          threshold: "",
          thresholdPercent: "",
          channel: "telegram",
          telegramChatId: "",
          webhookUrl: "",
          isRepeating: true,
          cooldownMinutes: "60",
          description: ""
        })
        router.refresh()
      } else {
        toast.error(result.error || "Failed to create alert")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const isPercentAlert = formData.type.includes("pct_change")
  const isPriceAlert = formData.type.includes("price")
  const selectedCompany = companies.find(c => c.id === formData.companyId)
  const currency = selectedCompany?.tradingCurrency || "USD"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Alert
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Alert</DialogTitle>
          <DialogDescription>
            Set up a new price or mNAV alert.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Alert Name (Optional)</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Price Alert"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Alert Type</Label>
              <Select
                value={formData.type}
                onValueChange={value => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {alertTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Select
                value={formData.companyId}
                onValueChange={value => setFormData({ ...formData, companyId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} ({company.ticker})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="threshold">
              {isPercentAlert ? "Threshold (%)" : "Threshold Value"}
            </Label>
            <Input
              id="threshold"
              type="number"
              step={isPercentAlert ? "0.01" : "0.0001"}
              value={isPercentAlert ? formData.thresholdPercent : formData.threshold}
              onChange={e =>
                setFormData({
                  ...formData,
                  [isPercentAlert ? "thresholdPercent" : "threshold"]: e.target.value
                })
              }
              placeholder={isPercentAlert ? "5.00" : "100.00"}
              required
            />
            <p className="text-[10px] text-muted-foreground">
              {isPriceAlert
                ? `Enter the price in ${currency}`
                : formData.type.includes("mnav")
                  ? "Enter the mNAV multiple (e.g., 1.5 for 1.5x)"
                  : isPercentAlert
                    ? "Enter the percentage change"
                    : "Enter the threshold value"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="channel">Notification Channel</Label>
              <Select
                value={formData.channel}
                onValueChange={value => setFormData({ ...formData, channel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="slack">Slack</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cooldown">Cooldown (minutes)</Label>
              <Input
                id="cooldown"
                type="number"
                value={formData.cooldownMinutes}
                onChange={e =>
                  setFormData({ ...formData, cooldownMinutes: e.target.value })
                }
                placeholder="60"
              />
            </div>
          </div>

          {formData.channel === "telegram" && (
            <div className="space-y-2">
              <Label htmlFor="telegramChatId">Telegram Chat ID (Optional)</Label>
              <Input
                id="telegramChatId"
                value={formData.telegramChatId}
                onChange={e =>
                  setFormData({ ...formData, telegramChatId: e.target.value })
                }
                placeholder="Leave empty to use default"
              />
            </div>
          )}

          {formData.channel === "slack" && (
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Slack Webhook URL (Optional)</Label>
              <Input
                id="webhookUrl"
                value={formData.webhookUrl}
                onChange={e =>
                  setFormData({ ...formData, webhookUrl: e.target.value })
                }
                placeholder="Leave empty to use default"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={e =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Notes about this alert"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRepeating"
              checked={formData.isRepeating}
              onChange={e =>
                setFormData({ ...formData, isRepeating: e.target.checked })
              }
              className="rounded border-border"
            />
            <Label htmlFor="isRepeating" className="text-xs">
              Repeat alert (trigger multiple times with cooldown)
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.companyId}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Alert
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
