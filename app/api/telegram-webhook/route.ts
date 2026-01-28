import { sendTelegramMessage } from "@/lib/notifications/telegram"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

interface TelegramUpdate {
  message?: {
    message_id: number
    from: {
      id: number
      first_name: string
      last_name?: string
      username?: string
    }
    chat: {
      id: number
      type: string
    }
    text?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json()

    // Only handle messages
    if (!update.message?.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = update.message.chat.id.toString()
    const text = update.message.text
    const firstName = update.message.from.first_name
    const username = update.message.from.username

    // Handle /start command
    if (text === "/start" || text.startsWith("/start")) {
      await sendTelegramMessage({
        chatId,
        text: `👋 <b>Welcome to 210k Terminal Alerts${firstName ? `, ${firstName}` : ''}!</b>

Your Chat ID is:

<code>${chatId}</code>

━━━━━━━━━━━━━━━

<b>To complete setup:</b>
1. Copy your Chat ID above
2. Go to the Alerts page in 210k Terminal
3. Paste it in the "Connect Telegram" section

Once connected, you'll receive instant alerts for price changes, mNAV thresholds, and BTC holdings updates.

<i>210k Terminal</i>`
      })

      return NextResponse.json({ ok: true })
    }

    // Handle /chatid command (alternative way to get ID)
    if (text === "/chatid" || text === "/id") {
      await sendTelegramMessage({
        chatId,
        text: `Your Chat ID is: <code>${chatId}</code>`
      })

      return NextResponse.json({ ok: true })
    }

    // Handle /help command
    if (text === "/help") {
      await sendTelegramMessage({
        chatId,
        text: `<b>210k Terminal Bot Commands</b>

/start - Get your Chat ID for setup
/chatid - Show your Chat ID
/help - Show this help message

<b>Setup Instructions:</b>
1. Copy your Chat ID from /start
2. Paste it in 210k Terminal → Alerts → Connect Telegram

<i>Questions? Contact the 210k team.</i>`
      })

      return NextResponse.json({ ok: true })
    }

    // Default response for unknown commands
    if (text.startsWith("/")) {
      await sendTelegramMessage({
        chatId,
        text: `Unknown command. Try /help for available commands.`
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Telegram webhook error:", error)
    return NextResponse.json({ ok: true }) // Always return 200 to Telegram
  }
}

// GET endpoint to verify webhook is set up
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "210k Terminal Telegram Webhook"
  })
}
