import { sendTelegramMessage } from "@/lib/notifications/telegram"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const chatId = process.env.TELEGRAM_CHAT_ID_PRIMARY

  if (!chatId) {
    return NextResponse.json(
      { error: "TELEGRAM_CHAT_ID_PRIMARY not configured" },
      { status: 500 }
    )
  }

  const result = await sendTelegramMessage({
    chatId,
    text: `🧪 <b>Test Alert from 210k Terminal</b>

This confirms your Telegram integration is working!

<i>Sent from deployed application</i>`
  })

  return NextResponse.json({
    success: result.success,
    messageId: result.messageId,
    error: result.error
  })
}
