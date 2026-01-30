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
import type { InsertAlert } from "@/db/schema/alerts"
import { Loader2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface AddAlertDialogProps {
  companies: SelectCompany[]
}

const alertTypes = [
  // Company-specific alerts
  { value: "price_above", label: "Price Above", category: "company" },
  { value: "price_below", label: "Price Below", category: "company" },
  { value: "mnav_above", label: "mNAV Above", category: "company" },
  { value: "mnav_below", label: "mNAV Below", category: "company" },
  { value: "btc_holdings", label: "BTC Holdings Change", category: "company" },
  { value: "pct_change_up", label: "% Change Up", category: "company" },
  { value: "pct_change_down", label: "% Change Down", category: "company" },
  // On-chain metric alerts
  { value: "fear_greed_above", label: "Fear & Greed Above", category: "onchain" },
  { value: "fear_greed_below", label: "Fear & Greed Below", category: "onchain" },
  { value: "mvrv_above", label: "MVRV Z-Score Above", category: "onchain" },
  { value: "mvrv_below", label: "MVRV Z-Score Below", category: "onchain" },
  { value: "nupl_above", label: "NUPL Above", category: "onchain" },
  { value: "nupl_below", label: "NUPL Below", category: "onchain" },
  { value: "funding_rate_above", label: "Funding Rate Above", category: "onchain" },
  { value: "funding_rate_below", label: "Funding Rate Below", category: "onchain" },
  // Daily digest
  { value: "onchain_daily_digest", label: "On-Chain Daily Digest", category: "digest" }
]

const onchainThresholdHelp: Record<string, string> = {
  fear_greed_above: "Fear & Greed Index (0-100). Extreme greed > 80, greed > 60",
  fear_greed_below: "Fear & Greed Index (0-100). Extreme fear < 20, fear < 40",
  mvrv_above: "MVRV Z-Score. Overvalued > 5, high > 3",
  mvrv_below: "MVRV Z-Score. Undervalued < 0, fair < 3",
  nupl_above: "NUPL as decimal (0-1). Euphoria > 0.75, belief > 0.5",
  nupl_below: "NUPL as decimal. Capitulation < 0, hope < 0.25",
  funding_rate_above: "Funding rate as % (e.g., 0.01 for 0.01%)",
  funding_rate_below: "Funding rate as % (e.g., -0.01 for -0.01%)"
}

export function AddAlertDialog({ companies }: AddAlertDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    companyId: "",
    type: "onchain_daily_digest",
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

      const alertCategory = alertTypes.find(t => t.value === formData.type)?.category

      const result = await createAlert({
        name: formData.name || null,
        companyId: alertCategory === "company" ? formData.companyId || null : null,
        type: formData.type as InsertAlert["type"],
        threshold: !isPercentAlert && !isDigestAlert && formData.threshold ? formData.threshold : null,
        thresholdPercent: isPercentAlert && formData.thresholdPercent ? formData.thresholdPercent : null,
        channel: formData.channel as "telegram" | "slack" | "email",
        telegramChatId: formData.channel === "telegram" ? formData.telegramChatId || null : null,
        webhookUrl: formData.channel === "slack" ? formData.webhookUrl || null : null,
        isRepeating: isDigestAlert ? true : formData.isRepeating,
        cooldownMinutes: isDigestAlert ? "1440" : formData.cooldownMinutes || null, // 24 hours for digest
        description: formData.description || null
      })

      if (result.isSuccess) {
        toast.success("Alert created successfully")
        setOpen(false)
        setFormData({
          name: "",
          companyId: "",
          type: "onchain_daily_digest",
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
  const isOnchainAlert = alertTypes.find(t => t.value === formData.type)?.category === "onchain"
  const isDigestAlert = formData.type === "onchain_daily_digest"
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

          <div className="space-y-2">
            <Label htmlFor="type">Alert Type</Label>
            <Select
              value={formData.type}
              onValueChange={value => setFormData({ ...formData, type: value, companyId: "" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Daily Digest</div>
                {alertTypes.filter(t => t.category === "digest").map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">On-Chain Alerts</div>
                {alertTypes.filter(t => t.category === "onchain").map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Company Alerts</div>
                {alertTypes.filter(t => t.category === "company").map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isOnchainAlert && !isDigestAlert && (
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
          )}

          {!isDigestAlert && (
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
                placeholder={isPercentAlert ? "5.00" : isOnchainAlert ? "0" : "100.00"}
                required
              />
              <p className="text-[10px] text-muted-foreground">
                {isOnchainAlert
                  ? onchainThresholdHelp[formData.type] || "Enter the threshold value"
                  : isPriceAlert
                    ? `Enter the price in ${currency}`
                    : formData.type.includes("mnav")
                      ? "Enter the mNAV multiple (e.g., 1.5 for 1.5x)"
                      : isPercentAlert
                        ? "Enter the percentage change"
                        : "Enter the threshold value"}
              </p>
            </div>
          )}

          {isDigestAlert && (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                Daily digest will send a summary of all on-chain metrics every day at 9 AM ET including:
              </p>
              <ul className="mt-2 text-xs text-muted-foreground list-disc list-inside space-y-1">
                <li>Fear & Greed Index</li>
                <li>MVRV Z-Score</li>
                <li>NUPL (Net Unrealized Profit/Loss)</li>
                <li>Funding Rates</li>
                <li>Price vs 200 WMA</li>
              </ul>
            </div>
          )}

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
            <Button
              type="submit"
              disabled={isLoading || (!isOnchainAlert && !isDigestAlert && !formData.companyId)}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Alert
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
