import { db } from "@/db"
import { customers } from "@/db/schema/customers"
import { sendTelegramMessage } from "@/lib/notifications/telegram"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const chatId = body.chatId

    if (!chatId || !/^\d+$/.test(chatId)) {
      return NextResponse.json({ error: "Invalid Chat ID" }, { status: 400 })
    }

    // Check if bot token is configured
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN not configured")
      return NextResponse.json(
        { error: "Telegram bot not configured. Please contact admin." },
        { status: 500 }
      )
    }

    // Send test message
    const testResult = await sendTelegramMessage({
      chatId,
      text: `✅ <b>Telegram Connected!</b>

Your 210k Terminal account is now linked.

You'll receive alerts for:
• Price threshold breaches
• mNAV changes
• BTC holdings updates

<i>Manage alerts at 210k-terminal.vercel.app/dashboard/alerts</i>`
    })

    if (!testResult.success) {
      console.error("Failed to send test message:", testResult.error)
      return NextResponse.json(
        { error: testResult.error || "Could not send test message" },
        { status: 400 }
      )
    }

    // Save to database
    await db
      .update(customers)
      .set({
        telegramChatId: chatId,
        telegramConnectedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(customers.userId, userId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Connect telegram error:", error)
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    )
  }
}
