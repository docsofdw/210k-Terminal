/**
 * Slack Webhook integration for sending notifications
 *
 * Environment variables required:
 * - SLACK_WEBHOOK_URL: Incoming webhook URL from Slack
 */

interface SlackSendResult {
  success: boolean
  error?: string
}

interface SlackBlock {
  type: string
  text?: {
    type: string
    text: string
    emoji?: boolean
  }
  fields?: {
    type: string
    text: string
  }[]
}

interface SlackMessage {
  webhookUrl?: string
  text: string
  blocks?: SlackBlock[]
  username?: string
  iconEmoji?: string
}

/**
 * Send a message via Slack incoming webhook
 */
export async function sendSlackMessage(
  message: SlackMessage
): Promise<SlackSendResult> {
  const webhookUrl = message.webhookUrl || process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    console.error("SLACK_WEBHOOK_URL is not configured")
    return { success: false, error: "Webhook URL not configured" }
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: message.text,
        blocks: message.blocks,
        username: message.username || "210k Terminal",
        icon_emoji: message.iconEmoji || ":chart_with_upwards_trend:"
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Slack webhook error:", errorText)
      return { success: false, error: errorText }
    }

    return { success: true }
  } catch (error) {
    console.error("Error sending Slack message:", error)
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
  webhookUrl: string | undefined,
  ticker: string,
  companyName: string,
  alertType: string,
  currentValue: number,
  threshold: number
): Promise<SlackSendResult> {
  const emoji = alertType.includes("above") ? ":arrow_up:" : ":arrow_down:"

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} Price Alert: ${ticker}`,
        emoji: true
      }
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Company:*\n${companyName}`
        },
        {
          type: "mrkdwn",
          text: `*Alert Type:*\n${alertType.replace(/_/g, " ").toUpperCase()}`
        },
        {
          type: "mrkdwn",
          text: `*Current:*\n$${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        },
        {
          type: "mrkdwn",
          text: `*Threshold:*\n$${threshold.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        }
      ]
    }
  ]

  return sendSlackMessage({
    webhookUrl,
    text: `Price Alert: ${ticker} - ${alertType}`,
    blocks
  })
}

/**
 * Send an mNAV alert notification
 */
export async function sendMnavAlert(
  webhookUrl: string | undefined,
  ticker: string,
  companyName: string,
  alertType: string,
  currentMnav: number,
  threshold: number
): Promise<SlackSendResult> {
  const emoji = alertType.includes("above") ? ":chart_with_upwards_trend:" : ":chart_with_downwards_trend:"

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} mNAV Alert: ${ticker}`,
        emoji: true
      }
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Company:*\n${companyName}`
        },
        {
          type: "mrkdwn",
          text: `*Alert Type:*\n${alertType.replace(/_/g, " ").toUpperCase()}`
        },
        {
          type: "mrkdwn",
          text: `*Current mNAV:*\n${currentMnav.toFixed(2)}x`
        },
        {
          type: "mrkdwn",
          text: `*Threshold:*\n${threshold.toFixed(2)}x`
        }
      ]
    }
  ]

  return sendSlackMessage({
    webhookUrl,
    text: `mNAV Alert: ${ticker} - ${alertType}`,
    blocks
  })
}

/**
 * Send a BTC holdings change alert
 */
export async function sendHoldingsAlert(
  webhookUrl: string | undefined,
  ticker: string,
  companyName: string,
  previousHoldings: number,
  newHoldings: number,
  source?: string
): Promise<SlackSendResult> {
  const change = newHoldings - previousHoldings
  const changePercent = previousHoldings > 0 ? (change / previousHoldings) * 100 : 0
  const emoji = change > 0 ? ":bitcoin:" : ":small_red_triangle_down:"

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} BTC Holdings Update: ${ticker}`,
        emoji: true
      }
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Company:*\n${companyName}`
        },
        {
          type: "mrkdwn",
          text: `*Previous:*\n${previousHoldings.toLocaleString()} BTC`
        },
        {
          type: "mrkdwn",
          text: `*New:*\n${newHoldings.toLocaleString()} BTC`
        },
        {
          type: "mrkdwn",
          text: `*Change:*\n${change >= 0 ? "+" : ""}${change.toLocaleString()} BTC (${changePercent.toFixed(1)}%)`
        }
      ]
    }
  ]

  if (source) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Source:* ${source}`
      }
    })
  }

  return sendSlackMessage({
    webhookUrl,
    text: `BTC Holdings Update: ${ticker}`,
    blocks
  })
}

/**
 * Send to default webhook (configured in env)
 */
export async function sendToDefaultWebhook(text: string): Promise<SlackSendResult> {
  return sendSlackMessage({ text })
}
