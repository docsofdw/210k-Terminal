/**
 * Telegram Bot API integration for sending notifications
 *
 * Environment variables required:
 * - TELEGRAM_BOT_TOKEN: Bot token from @BotFather
 * - TELEGRAM_CHAT_ID_PRIMARY: Primary user chat ID
 * - TELEGRAM_CHAT_ID_SECONDARY: Secondary user chat ID (optional)
 */

const TELEGRAM_API_BASE = "https://api.telegram.org/bot"

interface TelegramSendResult {
  success: boolean
  messageId?: number
  error?: string
}

interface TelegramMessage {
  chatId: string
  text: string
  parseMode?: "HTML" | "Markdown" | "MarkdownV2"
  disableNotification?: boolean
}

/**
 * Send a message via Telegram Bot API
 */
export async function sendTelegramMessage(
  message: TelegramMessage
): Promise<TelegramSendResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN is not configured")
    return { success: false, error: "Bot token not configured" }
  }

  try {
    const response = await fetch(
      `${TELEGRAM_API_BASE}${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: message.chatId,
          text: message.text,
          parse_mode: message.parseMode || "HTML",
          disable_notification: message.disableNotification || false
        })
      }
    )

    const data = await response.json()

    if (!response.ok || !data.ok) {
      console.error("Telegram API error:", data)
      return {
        success: false,
        error: data.description || "Unknown Telegram error"
      }
    }

    return {
      success: true,
      messageId: data.result?.message_id
    }
  } catch (error) {
    console.error("Error sending Telegram message:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error"
    }
  }
}

/**
 * Send a price alert notification
 */
export async function sendPriceAlert(
  chatId: string,
  ticker: string,
  companyName: string,
  alertType: string,
  currentValue: number,
  threshold: number
): Promise<TelegramSendResult> {
  const emoji = alertType.includes("above") ? "🔼" : "🔽"
  const text = `
${emoji} <b>Price Alert: ${ticker}</b>

<b>Company:</b> ${companyName}
<b>Alert Type:</b> ${alertType.replace(/_/g, " ").toUpperCase()}
<b>Current:</b> $${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
<b>Threshold:</b> $${threshold.toLocaleString(undefined, { minimumFractionDigits: 2 })}

<i>210k Terminal</i>
`.trim()

  return sendTelegramMessage({ chatId, text })
}

/**
 * Send an mNAV alert notification
 */
export async function sendMnavAlert(
  chatId: string,
  ticker: string,
  companyName: string,
  alertType: string,
  currentMnav: number,
  threshold: number
): Promise<TelegramSendResult> {
  const emoji = alertType.includes("above") ? "📈" : "📉"
  const text = `
${emoji} <b>mNAV Alert: ${ticker}</b>

<b>Company:</b> ${companyName}
<b>Alert Type:</b> ${alertType.replace(/_/g, " ").toUpperCase()}
<b>Current mNAV:</b> ${currentMnav.toFixed(2)}x
<b>Threshold:</b> ${threshold.toFixed(2)}x

<i>210k Terminal</i>
`.trim()

  return sendTelegramMessage({ chatId, text })
}

/**
 * Send a BTC holdings change alert
 */
export async function sendHoldingsAlert(
  chatId: string,
  ticker: string,
  companyName: string,
  previousHoldings: number,
  newHoldings: number,
  source?: string
): Promise<TelegramSendResult> {
  const change = newHoldings - previousHoldings
  const changePercent = previousHoldings > 0 ? (change / previousHoldings) * 100 : 0
  const emoji = change > 0 ? "₿➕" : "₿➖"

  const text = `
${emoji} <b>BTC Holdings Update: ${ticker}</b>

<b>Company:</b> ${companyName}
<b>Previous:</b> ${previousHoldings.toLocaleString()} BTC
<b>New:</b> ${newHoldings.toLocaleString()} BTC
<b>Change:</b> ${change >= 0 ? "+" : ""}${change.toLocaleString()} BTC (${changePercent.toFixed(1)}%)
${source ? `<b>Source:</b> ${source}` : ""}

<i>210k Terminal</i>
`.trim()

  return sendTelegramMessage({ chatId, text })
}

/**
 * Send to primary chat (configured in env)
 */
export async function sendToPrimaryChat(text: string): Promise<TelegramSendResult> {
  const chatId = process.env.TELEGRAM_CHAT_ID_PRIMARY

  if (!chatId) {
    return { success: false, error: "Primary chat ID not configured" }
  }

  return sendTelegramMessage({ chatId, text })
}

/**
 * Send to secondary chat (configured in env)
 */
export async function sendToSecondaryChat(text: string): Promise<TelegramSendResult> {
  const chatId = process.env.TELEGRAM_CHAT_ID_SECONDARY

  if (!chatId) {
    return { success: false, error: "Secondary chat ID not configured" }
  }

  return sendTelegramMessage({ chatId, text })
}

/**
 * Send scraper status notification
 */
export async function sendScraperNotification(
  results: Array<{
    company: string
    ticker: string
    success: boolean
    sharesOutstanding?: number
    dilutedShares?: number
    error?: string
    changed?: boolean
  }>
): Promise<TelegramSendResult> {
  const chatId = process.env.TELEGRAM_CHAT_ID_PRIMARY
  if (!chatId) {
    return { success: false, error: "Primary chat ID not configured" }
  }

  const successful = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)
  const changed = results.filter((r) => r.changed)

  const lines = [
    "📊 <b>Portfolio Data Scraper</b>",
    ""
  ]

  if (changed.length > 0) {
    lines.push("<b>Updated:</b>")
    for (const r of changed) {
      lines.push(
        `✓ ${r.company} (${r.ticker}): ${r.sharesOutstanding?.toLocaleString()} / ${r.dilutedShares?.toLocaleString()}`
      )
    }
    lines.push("")
  }

  if (failed.length > 0) {
    lines.push("<b>Failed:</b>")
    for (const r of failed) {
      lines.push(`✗ ${r.company}: ${r.error}`)
    }
    lines.push("")
  }

  const unchangedCount = successful.length - changed.length
  if (unchangedCount > 0) {
    lines.push(`<i>${unchangedCount} companies unchanged</i>`)
  }

  lines.push("", "<i>210k Terminal</i>")

  return sendTelegramMessage({ chatId, text: lines.join("\n") })
}

/**
 * Send scraper failure alert
 */
export async function sendScraperFailureAlert(
  scraperName: string,
  error: string
): Promise<TelegramSendResult> {
  const text = `
⚠️ <b>Scraper Failed: ${scraperName}</b>

<b>Error:</b> ${error}

<i>210k Terminal</i>
`.trim()

  return sendToPrimaryChat(text)
}
