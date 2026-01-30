"use server"

import { db } from "@/db"
import {
  alerts,
  type InsertAlert,
  type SelectAlert
} from "@/db/schema/alerts"
import {
  alertHistory,
  type InsertAlertHistory,
  type SelectAlertHistory
} from "@/db/schema/alert-history"
import { companies } from "@/db/schema/companies"
import { eq, desc, and } from "drizzle-orm"
import { logAudit } from "./audit"
import { requireAuth } from "@/lib/auth/permissions"
import * as telegram from "@/lib/notifications/telegram"
import * as slack from "@/lib/notifications/slack"

// ============ ALERTS ============

export async function getAlerts(): Promise<SelectAlert[]> {
  const user = await requireAuth()

  const userAlerts = await db.query.alerts.findMany({
    where: eq(alerts.userId, user.userId),
    orderBy: [desc(alerts.createdAt)]
  })

  return userAlerts
}

export async function getAlertsWithCompanies() {
  const user = await requireAuth()

  const userAlerts = await db
    .select({
      alert: alerts,
      company: companies
    })
    .from(alerts)
    .leftJoin(companies, eq(alerts.companyId, companies.id))
    .where(eq(alerts.userId, user.userId))
    .orderBy(desc(alerts.createdAt))

  return userAlerts
}

export async function getActiveAlerts(): Promise<SelectAlert[]> {
  const user = await requireAuth()

  const activeAlerts = await db.query.alerts.findMany({
    where: and(
      eq(alerts.userId, user.userId),
      eq(alerts.status, "active")
    ),
    orderBy: [desc(alerts.createdAt)]
  })

  return activeAlerts
}

export async function getAlertById(id: string): Promise<SelectAlert | null> {
  const user = await requireAuth()

  const alert = await db.query.alerts.findFirst({
    where: and(eq(alerts.id, id), eq(alerts.userId, user.userId))
  })

  return alert || null
}

export async function createAlert(
  data: Omit<InsertAlert, "userId">
): Promise<{ isSuccess: boolean; data?: SelectAlert; error?: string }> {
  try {
    const user = await requireAuth()

    const [newAlert] = await db
      .insert(alerts)
      .values({
        ...data,
        userId: user.userId
      })
      .returning()

    if (!newAlert) {
      return { isSuccess: false, error: "Failed to create alert" }
    }

    await logAudit({
      action: "create",
      entity: "alert",
      entityId: newAlert.id,
      entityName: newAlert.name || `${newAlert.type} alert`,
      changesAfter: newAlert as unknown as Record<string, unknown>,
      description: `Created alert: ${newAlert.type}`
    })

    return { isSuccess: true, data: newAlert }
  } catch (error) {
    console.error("Error creating alert:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export async function updateAlert(
  id: string,
  updates: Partial<InsertAlert>
): Promise<{ isSuccess: boolean; data?: SelectAlert; error?: string }> {
  try {
    const user = await requireAuth()

    const currentAlert = await getAlertById(id)
    if (!currentAlert) {
      return { isSuccess: false, error: "Alert not found" }
    }

    const [updatedAlert] = await db
      .update(alerts)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(and(eq(alerts.id, id), eq(alerts.userId, user.userId)))
      .returning()

    if (!updatedAlert) {
      return { isSuccess: false, error: "Failed to update alert" }
    }

    await logAudit({
      action: "update",
      entity: "alert",
      entityId: updatedAlert.id,
      entityName: updatedAlert.name || `${updatedAlert.type} alert`,
      changesBefore: currentAlert as unknown as Record<string, unknown>,
      changesAfter: updatedAlert as unknown as Record<string, unknown>,
      description: `Updated alert`
    })

    return { isSuccess: true, data: updatedAlert }
  } catch (error) {
    console.error("Error updating alert:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export async function deleteAlert(
  id: string
): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    const user = await requireAuth()

    const alert = await getAlertById(id)
    if (!alert) {
      return { isSuccess: false, error: "Alert not found" }
    }

    // Delete related alert history first (foreign key constraint)
    await db
      .delete(alertHistory)
      .where(eq(alertHistory.alertId, id))

    // Then delete the alert
    await db
      .delete(alerts)
      .where(and(eq(alerts.id, id), eq(alerts.userId, user.userId)))

    await logAudit({
      action: "delete",
      entity: "alert",
      entityId: id,
      entityName: alert.name || `${alert.type} alert`,
      changesBefore: alert as unknown as Record<string, unknown>,
      description: `Deleted alert`
    })

    return { isSuccess: true }
  } catch (error) {
    console.error("Error deleting alert:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export async function toggleAlertStatus(
  id: string,
  status: "active" | "paused"
): Promise<{ isSuccess: boolean; error?: string }> {
  return updateAlert(id, { status })
}

// ============ ALERT HISTORY ============

export async function getAlertHistory(): Promise<SelectAlertHistory[]> {
  const user = await requireAuth()

  const history = await db.query.alertHistory.findMany({
    where: eq(alertHistory.userId, user.userId),
    orderBy: [desc(alertHistory.triggeredAt)]
  })

  return history
}

export async function getAlertHistoryWithDetails() {
  const user = await requireAuth()

  const history = await db
    .select({
      history: alertHistory,
      alert: alerts,
      company: companies
    })
    .from(alertHistory)
    .leftJoin(alerts, eq(alertHistory.alertId, alerts.id))
    .leftJoin(companies, eq(alertHistory.companyId, companies.id))
    .where(eq(alertHistory.userId, user.userId))
    .orderBy(desc(alertHistory.triggeredAt))

  return history
}

// ============ ALERT PROCESSING ============

interface TriggerAlertParams {
  alert: SelectAlert
  companyName: string
  companyTicker: string
  actualValue: number
  previousValue?: number
  currency?: string
  context?: Record<string, unknown>
}

interface TriggerOnchainAlertParams {
  alert: SelectAlert
  metricName: string
  actualValue: number
  threshold: number
  context?: Record<string, unknown>
}

/**
 * Trigger an alert and send notifications
 */
export async function triggerAlert({
  alert,
  companyName,
  companyTicker,
  actualValue,
  previousValue,
  currency = "USD",
  context
}: TriggerAlertParams): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    // Check cooldown
    if (alert.lastTriggeredAt && alert.cooldownMinutes) {
      const cooldownMs = parseFloat(alert.cooldownMinutes) * 60 * 1000
      const timeSinceLastTrigger =
        Date.now() - new Date(alert.lastTriggeredAt).getTime()

      if (timeSinceLastTrigger < cooldownMs) {
        return { isSuccess: false, error: "Alert is in cooldown period" }
      }
    }

    // Build message
    const threshold = alert.threshold ? parseFloat(alert.threshold) : 0
    const direction = alert.type.includes("above") || alert.type.includes("up") ? "above" : "below"
    const directionEmoji = direction === "above" ? "⬆️" : "⬇️"

    let telegramMessage = ""
    let slackMessage = ""

    switch (alert.type) {
      case "price_above":
      case "price_below":
        telegramMessage = `${directionEmoji} <b>${companyTicker}</b> Price

Crossed ${direction} <b>${currency} ${threshold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
Current: <b>${currency} ${actualValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>

<i>210k Terminal</i>`

        slackMessage = `${directionEmoji} *${companyTicker}* Price\nCrossed ${direction} *${currency} ${threshold.toFixed(2)}* → Current: *${currency} ${actualValue.toFixed(2)}*`
        break

      case "mnav_above":
      case "mnav_below":
        telegramMessage = `${directionEmoji} <b>${companyTicker}</b> mNAV

Crossed ${direction} <b>${threshold.toFixed(2)}x</b>
Current: <b>${actualValue.toFixed(2)}x</b>

<i>210k Terminal</i>`

        slackMessage = `${directionEmoji} *${companyTicker}* mNAV\nCrossed ${direction} *${threshold.toFixed(2)}x* → Current: *${actualValue.toFixed(2)}x*`
        break

      case "btc_holdings":
        const change = actualValue - (previousValue || 0)
        const changeEmoji = change > 0 ? "🟢" : "🔴"
        telegramMessage = `${changeEmoji} <b>${companyTicker}</b> BTC Holdings

<code>Previous  ${(previousValue?.toLocaleString() || "?").padStart(10)}
Current   ${actualValue.toLocaleString().padStart(10)}
Change    ${((change >= 0 ? "+" : "") + change.toLocaleString()).padStart(10)}</code>

<i>210k Terminal</i>`

        slackMessage = `${changeEmoji} *${companyTicker}* BTC Holdings\nPrevious: ${previousValue?.toLocaleString() || "?"} → Current: *${actualValue.toLocaleString()}* (${change >= 0 ? "+" : ""}${change.toLocaleString()})`
        break

      case "pct_change_up":
      case "pct_change_down":
        const pctThreshold = alert.thresholdPercent ? parseFloat(alert.thresholdPercent) : 0
        const pctEmoji = actualValue > 0 ? "📈" : "📉"
        telegramMessage = `${pctEmoji} <b>${companyTicker}</b> ${actualValue >= 0 ? "+" : ""}${actualValue.toFixed(2)}%

Threshold: ${pctThreshold.toFixed(2)}%

<i>210k Terminal</i>`

        slackMessage = `${pctEmoji} *${companyTicker}* ${actualValue >= 0 ? "+" : ""}${actualValue.toFixed(2)}% (threshold: ${pctThreshold.toFixed(2)}%)`
        break
    }

    // Send notification
    let notificationSent = false
    let notificationError: string | undefined
    const messageTitle = `${alert.type.replace(/_/g, " ").toUpperCase()}: ${companyTicker}`
    const messageBody = telegramMessage

    if (alert.channel === "telegram") {
      const chatId = alert.telegramChatId || process.env.TELEGRAM_CHAT_ID_PRIMARY
      if (chatId) {
        const result = await telegram.sendTelegramMessage({
          chatId,
          text: telegramMessage
        })
        notificationSent = result.success
        notificationError = result.error
      }
    } else if (alert.channel === "slack") {
      const webhookUrl = alert.webhookUrl || process.env.SLACK_WEBHOOK_URL
      if (webhookUrl) {
        const result = await slack.sendSlackMessage({
          webhookUrl,
          text: slackMessage
        })
        notificationSent = result.success
        notificationError = result.error
      }
    }

    // Record in history
    await db.insert(alertHistory).values({
      alertId: alert.id,
      userId: alert.userId,
      companyId: alert.companyId,
      alertType: alert.type,
      threshold: alert.threshold,
      thresholdPercent: alert.thresholdPercent,
      actualValue: actualValue.toString(),
      previousValue: previousValue?.toString(),
      channel: alert.channel,
      notificationSent,
      notificationError,
      context: context as Record<string, unknown>,
      messageTitle,
      messageBody
    })

    // Update alert stats
    const newTriggerCount = (parseInt(alert.triggerCount?.toString() || "0") + 1).toString()

    await db
      .update(alerts)
      .set({
        lastTriggeredAt: new Date(),
        triggerCount: newTriggerCount,
        status: alert.isRepeating ? "active" : "triggered",
        updatedAt: new Date()
      })
      .where(eq(alerts.id, alert.id))

    return { isSuccess: true }
  } catch (error) {
    console.error("Error triggering alert:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Trigger an on-chain metric alert
 */
export async function triggerOnchainAlert({
  alert,
  metricName,
  actualValue,
  threshold,
  context
}: TriggerOnchainAlertParams): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    // Check cooldown
    if (alert.lastTriggeredAt && alert.cooldownMinutes) {
      const cooldownMs = parseFloat(alert.cooldownMinutes) * 60 * 1000
      const timeSinceLastTrigger =
        Date.now() - new Date(alert.lastTriggeredAt).getTime()

      if (timeSinceLastTrigger < cooldownMs) {
        return { isSuccess: false, error: "Alert is in cooldown period" }
      }
    }

    const direction = alert.type.includes("above") ? "above" : "below"
    const directionEmoji = direction === "above" ? "⬆️" : "⬇️"

    let telegramMessage = ""
    let slackMessage = ""
    let formattedValue = ""
    let formattedThreshold = ""

    // Format values based on metric type
    if (alert.type.includes("fear_greed")) {
      formattedValue = actualValue.toFixed(0)
      formattedThreshold = threshold.toFixed(0)
    } else if (alert.type.includes("mvrv")) {
      formattedValue = actualValue.toFixed(2)
      formattedThreshold = threshold.toFixed(2)
    } else if (alert.type.includes("nupl")) {
      formattedValue = (actualValue * 100).toFixed(1) + "%"
      formattedThreshold = (threshold * 100).toFixed(1) + "%"
    } else if (alert.type.includes("funding")) {
      formattedValue = (actualValue * 100).toFixed(4) + "%"
      formattedThreshold = (threshold * 100).toFixed(4) + "%"
    }

    // Add full metric descriptions for context
    const metricDescription: Record<string, string> = {
      "MVRV Z-Score": "Market Value to Realized Value",
      "NUPL": "Net Unrealized Profit/Loss",
      "Funding Rate": "Perpetual Futures Funding",
      "Fear & Greed Index": "Market Sentiment Index"
    }
    const description = metricDescription[metricName] || ""

    telegramMessage = `${directionEmoji} <b>${metricName}</b>${description ? `\n<i>${description}</i>` : ""}

Crossed ${direction} <b>${formattedThreshold}</b>
Current: <b>${formattedValue}</b>

<i>210k Terminal</i>`

    slackMessage = `${directionEmoji} *${metricName}*${description ? ` (${description})` : ""}\nCrossed ${direction} *${formattedThreshold}* → Current: *${formattedValue}*`

    // Send notification
    let notificationSent = false
    let notificationError: string | undefined
    const messageTitle = `${metricName.toUpperCase()}: ${formattedValue}`
    const messageBody = telegramMessage

    if (alert.channel === "telegram") {
      const chatId = alert.telegramChatId || process.env.TELEGRAM_CHAT_ID_PRIMARY
      if (chatId) {
        const result = await telegram.sendTelegramMessage({
          chatId,
          text: telegramMessage
        })
        notificationSent = result.success
        notificationError = result.error
      }
    } else if (alert.channel === "slack") {
      const webhookUrl = alert.webhookUrl || process.env.SLACK_WEBHOOK_URL
      if (webhookUrl) {
        const result = await slack.sendSlackMessage({
          webhookUrl,
          text: slackMessage
        })
        notificationSent = result.success
        notificationError = result.error
      }
    }

    // Record in history
    await db.insert(alertHistory).values({
      alertId: alert.id,
      userId: alert.userId,
      companyId: null,
      alertType: alert.type,
      threshold: alert.threshold,
      thresholdPercent: alert.thresholdPercent,
      actualValue: actualValue.toString(),
      channel: alert.channel,
      notificationSent,
      notificationError,
      context: context as Record<string, unknown>,
      messageTitle,
      messageBody
    })

    // Update alert stats
    const newTriggerCount = (parseInt(alert.triggerCount?.toString() || "0") + 1).toString()

    await db
      .update(alerts)
      .set({
        lastTriggeredAt: new Date(),
        triggerCount: newTriggerCount,
        status: alert.isRepeating ? "active" : "triggered",
        updatedAt: new Date()
      })
      .where(eq(alerts.id, alert.id))

    return { isSuccess: true }
  } catch (error) {
    console.error("Error triggering on-chain alert:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Send daily on-chain digest
 */
export async function sendOnchainDigest(
  alert: SelectAlert,
  metrics: {
    fearGreed: number
    mvrvZScore: number
    nupl: number
    fundingRate: number
    btcPrice: number
    premium200WMA: number
  }
): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    // Check cooldown (should be 24 hours for digest)
    if (alert.lastTriggeredAt && alert.cooldownMinutes) {
      const cooldownMs = parseFloat(alert.cooldownMinutes) * 60 * 1000
      const timeSinceLastTrigger =
        Date.now() - new Date(alert.lastTriggeredAt).getTime()

      if (timeSinceLastTrigger < cooldownMs) {
        return { isSuccess: false, error: "Digest is in cooldown period" }
      }
    }

    // Determine sentiment labels
    const fgLabel = metrics.fearGreed <= 20 ? "Extreme Fear" :
                    metrics.fearGreed <= 40 ? "Fear" :
                    metrics.fearGreed <= 60 ? "Neutral" :
                    metrics.fearGreed <= 80 ? "Greed" : "Extreme Greed"

    const mvrvLabel = metrics.mvrvZScore >= 7 ? "Overvalued" :
                      metrics.mvrvZScore >= 5 ? "High" :
                      metrics.mvrvZScore >= 3 ? "Fair+" :
                      metrics.mvrvZScore >= 0 ? "Fair" : "Undervalued"

    const nuplLabel = metrics.nupl >= 0.75 ? "Euphoria" :
                      metrics.nupl >= 0.5 ? "Belief" :
                      metrics.nupl >= 0.25 ? "Optimism" :
                      metrics.nupl >= 0 ? "Hope" : "Capitulation"

    const frPercent = metrics.fundingRate * 100
    const frLabel = frPercent >= 0.05 ? "Hot" :
                    frPercent >= 0.01 ? "Bullish" :
                    frPercent >= 0 ? "Neutral" :
                    frPercent >= -0.01 ? "Bearish" : "Negative"

    const wmaLabel = metrics.premium200WMA >= 100 ? "Extended" :
                     metrics.premium200WMA >= 50 ? "Healthy" :
                     metrics.premium200WMA >= 0 ? "Near Support" : "Below"

    const telegramMessage = `📊 <b>On-Chain Brief</b> • ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}

<b>₿ $${metrics.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b>

<code>F&G    ${String(metrics.fearGreed).padStart(5)}  (${fgLabel})
MVRV   ${metrics.mvrvZScore.toFixed(2).padStart(5)}  (${mvrvLabel})
NUPL   ${((metrics.nupl * 100).toFixed(0) + "%").padStart(5)}  (${nuplLabel})
FR     ${(frPercent.toFixed(2) + "%").padStart(5)}  (${frLabel})
200W   ${((metrics.premium200WMA >= 0 ? "+" : "") + metrics.premium200WMA.toFixed(0) + "%").padStart(5)}  (${wmaLabel})</code>

<i>210k Terminal</i>`

    const slackMessage = `📊 *On-Chain Brief*\n\n*BTC $${metrics.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}*\n\nF&G *${metrics.fearGreed}* (${fgLabel}) • MVRV *${metrics.mvrvZScore.toFixed(2)}* (${mvrvLabel})\nNUPL *${(metrics.nupl * 100).toFixed(0)}%* (${nuplLabel}) • FR ${frPercent.toFixed(2)}% (${frLabel}) • 200W ${metrics.premium200WMA >= 0 ? "+" : ""}${metrics.premium200WMA.toFixed(0)}% (${wmaLabel})`

    // Send notification
    let notificationSent = false
    let notificationError: string | undefined

    if (alert.channel === "telegram") {
      const chatId = alert.telegramChatId || process.env.TELEGRAM_CHAT_ID_PRIMARY
      if (chatId) {
        const result = await telegram.sendTelegramMessage({
          chatId,
          text: telegramMessage
        })
        notificationSent = result.success
        notificationError = result.error
      }
    } else if (alert.channel === "slack") {
      const webhookUrl = alert.webhookUrl || process.env.SLACK_WEBHOOK_URL
      if (webhookUrl) {
        const result = await slack.sendSlackMessage({
          webhookUrl,
          text: slackMessage
        })
        notificationSent = result.success
        notificationError = result.error
      }
    }

    // Record in history
    await db.insert(alertHistory).values({
      alertId: alert.id,
      userId: alert.userId,
      companyId: null,
      alertType: alert.type,
      threshold: null,
      thresholdPercent: null,
      actualValue: null,
      channel: alert.channel,
      notificationSent,
      notificationError,
      context: metrics as unknown as Record<string, unknown>,
      messageTitle: "Daily On-Chain Digest",
      messageBody: telegramMessage
    })

    // Update alert stats
    const newTriggerCount = (parseInt(alert.triggerCount?.toString() || "0") + 1).toString()

    await db
      .update(alerts)
      .set({
        lastTriggeredAt: new Date(),
        triggerCount: newTriggerCount,
        updatedAt: new Date()
      })
      .where(eq(alerts.id, alert.id))

    return { isSuccess: true }
  } catch (error) {
    console.error("Error sending on-chain digest:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Check all active alerts and trigger any that meet their conditions
 * Called by the check-alerts cron job
 */
export async function checkAllAlerts(): Promise<{
  checked: number
  triggered: number
  errors: string[]
}> {
  const errors: string[] = []
  let checked = 0
  let triggered = 0

  try {
    // Get all active alerts with company data
    const activeAlerts = await db
      .select({
        alert: alerts,
        company: companies
      })
      .from(alerts)
      .leftJoin(companies, eq(alerts.companyId, companies.id))
      .where(eq(alerts.status, "active"))

    // Get latest prices
    const { getLatestBtcPrice, getLatestStockPrices, getLatestFxRates } = await import("./market-data")
    const { calculateMetrics } = await import("@/lib/calculations")

    const btcPriceData = await getLatestBtcPrice()
    const stockPricesMap = await getLatestStockPrices()
    const fxRatesMap = await getLatestFxRates()

    const btcPrice = btcPriceData ? Number(btcPriceData.priceUsd) : 0

    for (const { alert, company } of activeAlerts) {
      if (!company) continue
      checked++

      try {
        // Get current stock price
        const stockPrice = stockPricesMap.get(company.id)
        if (!stockPrice && alert.type.startsWith("price")) continue

        // Get FX rate for currency conversion
        // rateFromUsd converts local currency to USD (e.g., 1 HKD = 0.128 USD)
        const currency = company.tradingCurrency || "USD"
        const fxRate = fxRatesMap.get(currency)
        const fxToUsd = fxRate ? Number(fxRate.rateFromUsd) : 1

        const priceLocal = stockPrice ? Number(stockPrice.price) : 0
        const priceUsd = priceLocal * fxToUsd

        // Calculate metrics including mNAV
        const btcHoldings = Number(company.btcHoldings) || 0
        const sharesOutstanding = Number(company.sharesOutstanding) || 0
        const marketCapUsd = priceUsd * sharesOutstanding

        const metrics = calculateMetrics({
          btcHoldings,
          btcPrice,
          stockPrice: priceLocal,
          sharesOutstanding,
          marketCapUsd,
          cashUsd: Number(company.cashUsd) || 0,
          debtUsd: Number(company.debtUsd) || 0,
          preferredsUsd: Number(company.preferredsUsd) || 0,
          tradingCurrency: currency,
          fxRate: fxToUsd
        })

        const currentMnav = metrics.mNav

        const threshold = alert.threshold ? parseFloat(alert.threshold) : 0
        let shouldTrigger = false
        let actualValue = 0

        switch (alert.type) {
          case "price_above":
            // Use local price for comparison (threshold is in local currency)
            actualValue = priceLocal
            shouldTrigger = priceLocal > threshold
            break
          case "price_below":
            // Use local price for comparison (threshold is in local currency)
            actualValue = priceLocal
            shouldTrigger = priceLocal < threshold
            break
          case "mnav_above":
            actualValue = currentMnav
            shouldTrigger = currentMnav > threshold
            break
          case "mnav_below":
            actualValue = currentMnav
            shouldTrigger = currentMnav < threshold
            break
        }

        if (shouldTrigger) {
          const result = await triggerAlert({
            alert,
            companyName: company.name,
            companyTicker: company.ticker,
            actualValue,
            currency,
            context: { btcPrice, priceUsd, priceLocal, currentMnav }
          })

          if (result.isSuccess) {
            triggered++
          } else if (result.error && !result.error.includes("cooldown")) {
            errors.push(`${company.ticker}: ${result.error}`)
          }
        }
      } catch (alertError) {
        const errMsg = alertError instanceof Error ? alertError.message : "Unknown error"
        errors.push(`${company?.ticker || alert.id}: ${errMsg}`)
      }
    }

    // ============ CHECK ON-CHAIN ALERTS ============
    const onchainAlertTypes = [
      "fear_greed_above", "fear_greed_below",
      "mvrv_above", "mvrv_below",
      "nupl_above", "nupl_below",
      "funding_rate_above", "funding_rate_below",
      "onchain_daily_digest"
    ]

    const onchainAlerts = await db
      .select({ alert: alerts })
      .from(alerts)
      .where(
        and(
          eq(alerts.status, "active"),
          // TypeScript workaround - check if type is one of the on-chain types
        )
      )

    // Filter to only on-chain alerts
    const filteredOnchainAlerts = onchainAlerts.filter(
      ({ alert }) => onchainAlertTypes.includes(alert.type)
    )

    if (filteredOnchainAlerts.length > 0) {
      // Fetch on-chain metrics
      const { getFearAndGreed, getMvrvZScore, getNupl, getFundingRates, get200WMAHeatmap } =
        await import("./on-chain-metrics")

      const [fearGreedData, mvrvData, nuplData, fundingData, wmaData] = await Promise.all([
        getFearAndGreed(7),
        getMvrvZScore(7),
        getNupl(7),
        getFundingRates(7),
        get200WMAHeatmap(7)
      ])

      // Get latest values
      const latestFearGreed = fearGreedData.length > 0
        ? (fearGreedData[fearGreedData.length - 1]["value"] as number) ?? 50
        : 50

      const latestMvrv = mvrvData.length > 0
        ? (mvrvData[mvrvData.length - 1]["ZScore"] as number) ?? 0
        : 0

      const latestNupl = nuplData.length > 0
        ? (nuplData[nuplData.length - 1]["NUPL"] as number) ?? 0
        : 0

      const latestFunding = fundingData.length > 0
        ? (fundingData[fundingData.length - 1]["funding_rate_usd"] as number) ?? 0
        : 0

      const latestPrice = wmaData.length > 0
        ? (wmaData[wmaData.length - 1]["Price"] as number) ?? 0
        : btcPrice

      const latest200WMA = wmaData.length > 0
        ? (wmaData[wmaData.length - 1]["200week_avg"] as number) ?? 0
        : 0

      const premium200WMA = latest200WMA > 0
        ? ((latestPrice - latest200WMA) / latest200WMA) * 100
        : 0

      for (const { alert } of filteredOnchainAlerts) {
        checked++

        try {
          const threshold = alert.threshold ? parseFloat(alert.threshold) : 0
          let shouldTrigger = false
          let actualValue = 0
          let metricName = ""

          switch (alert.type) {
            case "fear_greed_above":
              actualValue = latestFearGreed
              shouldTrigger = latestFearGreed > threshold
              metricName = "Fear & Greed Index"
              break
            case "fear_greed_below":
              actualValue = latestFearGreed
              shouldTrigger = latestFearGreed < threshold
              metricName = "Fear & Greed Index"
              break
            case "mvrv_above":
              actualValue = latestMvrv
              shouldTrigger = latestMvrv > threshold
              metricName = "MVRV Z-Score"
              break
            case "mvrv_below":
              actualValue = latestMvrv
              shouldTrigger = latestMvrv < threshold
              metricName = "MVRV Z-Score"
              break
            case "nupl_above":
              actualValue = latestNupl
              shouldTrigger = latestNupl > threshold
              metricName = "NUPL"
              break
            case "nupl_below":
              actualValue = latestNupl
              shouldTrigger = latestNupl < threshold
              metricName = "NUPL"
              break
            case "funding_rate_above":
              actualValue = latestFunding
              shouldTrigger = latestFunding > threshold / 100 // Convert % threshold to decimal
              metricName = "Funding Rate"
              break
            case "funding_rate_below":
              actualValue = latestFunding
              shouldTrigger = latestFunding < threshold / 100
              metricName = "Funding Rate"
              break
            case "onchain_daily_digest":
              // Daily digest - check if enough time has passed (handled in sendOnchainDigest)
              const digestResult = await sendOnchainDigest(alert, {
                fearGreed: latestFearGreed,
                mvrvZScore: latestMvrv,
                nupl: latestNupl,
                fundingRate: latestFunding,
                btcPrice: latestPrice,
                premium200WMA
              })
              if (digestResult.isSuccess) {
                triggered++
              }
              continue // Skip the standard trigger logic
          }

          if (shouldTrigger) {
            const result = await triggerOnchainAlert({
              alert,
              metricName,
              actualValue,
              threshold: alert.type.includes("funding") ? threshold / 100 : threshold,
              context: {
                fearGreed: latestFearGreed,
                mvrv: latestMvrv,
                nupl: latestNupl,
                funding: latestFunding,
                btcPrice: latestPrice
              }
            })

            if (result.isSuccess) {
              triggered++
            } else if (result.error && !result.error.includes("cooldown")) {
              errors.push(`On-chain ${alert.type}: ${result.error}`)
            }
          }
        } catch (alertError) {
          const errMsg = alertError instanceof Error ? alertError.message : "Unknown error"
          errors.push(`On-chain ${alert.type}: ${errMsg}`)
        }
      }
    }

    return { checked, triggered, errors }
  } catch (error) {
    console.error("Error checking alerts:", error)
    errors.push(error instanceof Error ? error.message : "Unknown error")
    return { checked, triggered, errors }
  }
}
