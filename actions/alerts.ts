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
        telegramMessage = `${directionEmoji} <b>PRICE ALERT</b>

<b>${companyName}</b> (${companyTicker})

Price crossed ${direction} your threshold

━━━━━━━━━━━━━━━
📊 Current:    <b>${currency} ${actualValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
🎯 Threshold:  ${currency} ${threshold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
━━━━━━━━━━━━━━━

<i>210k Terminal</i>`

        slackMessage = `${directionEmoji} *PRICE ALERT*\n\n*${companyName}* (${companyTicker})\n\nPrice crossed ${direction} your threshold\n\n• Current: *${currency} ${actualValue.toFixed(2)}*\n• Threshold: ${currency} ${threshold.toFixed(2)}`
        break

      case "mnav_above":
      case "mnav_below":
        telegramMessage = `${directionEmoji} <b>mNAV ALERT</b>

<b>${companyName}</b> (${companyTicker})

mNAV crossed ${direction} your threshold

━━━━━━━━━━━━━━━
📊 Current:    <b>${actualValue.toFixed(2)}x</b>
🎯 Threshold:  ${threshold.toFixed(2)}x
━━━━━━━━━━━━━━━

<i>210k Terminal</i>`

        slackMessage = `${directionEmoji} *mNAV ALERT*\n\n*${companyName}* (${companyTicker})\n\nmNAV crossed ${direction} your threshold\n\n• Current: *${actualValue.toFixed(2)}x*\n• Threshold: ${threshold.toFixed(2)}x`
        break

      case "btc_holdings":
        const change = actualValue - (previousValue || 0)
        const changeEmoji = change > 0 ? "🟢" : "🔴"
        telegramMessage = `${changeEmoji} <b>BTC HOLDINGS UPDATE</b>

<b>${companyName}</b> (${companyTicker})

━━━━━━━━━━━━━━━
📊 Previous:  ${previousValue?.toLocaleString() || "?"} BTC
📊 Current:   <b>${actualValue.toLocaleString()} BTC</b>
📈 Change:    ${change >= 0 ? "+" : ""}${change.toLocaleString()} BTC
━━━━━━━━━━━━━━━

<i>210k Terminal</i>`

        slackMessage = `${changeEmoji} *BTC HOLDINGS UPDATE*\n\n*${companyName}* (${companyTicker})\n\n• Previous: ${previousValue?.toLocaleString() || "?"} BTC\n• Current: *${actualValue.toLocaleString()} BTC*\n• Change: ${change >= 0 ? "+" : ""}${change.toLocaleString()} BTC`
        break

      case "pct_change_up":
      case "pct_change_down":
        const pctThreshold = alert.thresholdPercent ? parseFloat(alert.thresholdPercent) : 0
        const pctEmoji = actualValue > 0 ? "📈" : "📉"
        telegramMessage = `${pctEmoji} <b>PRICE MOVEMENT</b>

<b>${companyName}</b> (${companyTicker})

Significant price movement detected

━━━━━━━━━━━━━━━
📊 Change:     <b>${actualValue >= 0 ? "+" : ""}${actualValue.toFixed(2)}%</b>
🎯 Threshold:  ${pctThreshold.toFixed(2)}%
━━━━━━━━━━━━━━━

<i>210k Terminal</i>`

        slackMessage = `${pctEmoji} *PRICE MOVEMENT*\n\n*${companyName}* (${companyTicker})\n\n• Change: *${actualValue >= 0 ? "+" : ""}${actualValue.toFixed(2)}%*\n• Threshold: ${pctThreshold.toFixed(2)}%`
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

    return { checked, triggered, errors }
  } catch (error) {
    console.error("Error checking alerts:", error)
    errors.push(error instanceof Error ? error.message : "Unknown error")
    return { checked, triggered, errors }
  }
}
