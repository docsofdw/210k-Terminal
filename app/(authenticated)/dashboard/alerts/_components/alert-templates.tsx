"use client"

import { createAlert } from "@/actions/alerts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { SelectCompany } from "@/db/schema/companies"
import { Loader2, TrendingDown, TrendingUp, Percent, Bitcoin } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface AlertTemplatesProps {
  companies: SelectCompany[]
  userTelegramConnected: boolean
}

interface AlertTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  type: "mnav_below" | "mnav_above" | "price_below" | "pct_change_down"
  threshold?: string
  thresholdPercent?: string
  companyRequired: boolean
}

const templates: AlertTemplate[] = [
  {
    id: "mnav-discount",
    name: "mNAV Below 1.0x",
    description: "Alert when trading at discount to BTC NAV",
    icon: <TrendingDown className="h-5 w-5 text-green-500" />,
    type: "mnav_below",
    threshold: "1.0",
    companyRequired: true
  },
  {
    id: "mnav-premium",
    name: "mNAV Above 2.0x",
    description: "Alert when trading at high premium",
    icon: <TrendingUp className="h-5 w-5 text-red-500" />,
    type: "mnav_above",
    threshold: "2.0",
    companyRequired: true
  },
  {
    id: "price-drop",
    name: "Price Drop 10%+",
    description: "Alert on significant price decline",
    icon: <Percent className="h-5 w-5 text-orange-500" />,
    type: "pct_change_down",
    thresholdPercent: "10",
    companyRequired: true
  }
]

export function AlertTemplates({ companies, userTelegramConnected }: AlertTemplatesProps) {
  const router = useRouter()
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<string>("")

  async function handleCreateFromTemplate(template: AlertTemplate) {
    if (template.companyRequired && !selectedCompany) {
      toast.error("Please select a company first")
      return
    }

    if (!userTelegramConnected) {
      toast.error("Please connect your Telegram first")
      return
    }

    setLoadingTemplate(template.id)

    try {
      const result = await createAlert({
        name: template.name,
        companyId: selectedCompany || null,
        type: template.type,
        threshold: template.threshold || null,
        thresholdPercent: template.thresholdPercent || null,
        channel: "telegram",
        isRepeating: true,
        cooldownMinutes: "60"
      })

      if (result.isSuccess) {
        toast.success(`Alert "${template.name}" created!`)
        router.refresh()
      } else {
        toast.error(result.error || "Failed to create alert")
      }
    } catch {
      toast.error("An error occurred")
    } finally {
      setLoadingTemplate(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Alert Templates</CardTitle>
        <CardDescription>
          Select a company and click to create pre-configured alerts instantly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Company Selector */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">
            Select Company
          </label>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Choose a company...</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name} ({company.ticker})
              </option>
            ))}
          </select>
        </div>

        {/* Template Buttons */}
        <div className="grid gap-2">
          {templates.map((template) => (
            <Button
              key={template.id}
              variant="outline"
              className="h-auto justify-start gap-3 p-3"
              disabled={loadingTemplate !== null || !userTelegramConnected}
              onClick={() => handleCreateFromTemplate(template)}
            >
              {loadingTemplate === template.id ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                template.icon
              )}
              <div className="text-left">
                <div className="font-medium">{template.name}</div>
                <div className="text-xs text-muted-foreground">
                  {template.description}
                </div>
              </div>
            </Button>
          ))}
        </div>

        {!userTelegramConnected && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            Connect Telegram below to enable alerts
          </p>
        )}
      </CardContent>
    </Card>
  )
}
