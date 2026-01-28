import { db } from "@/db"
import { customers } from "@/db/schema/customers"
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

    const botToken = process.env.TELEGRAM_BOT_TOKEN

    // Check if bot token is configured
    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN not configured. Available env vars:", Object.keys(process.env).filter(k => k.includes('TELEGRAM')))
      return NextResponse.json(
        { error: "Telegram bot not configured. Please contact admin." },
        { status: 500 }
      )
    }

    // Send test message directly using fetch
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ <b>Telegram Connected!</b>

Your 210k Terminal account is now linked.

You'll receive alerts for:
• Price threshold breaches
• mNAV changes
• BTC holdings updates

<i>210k Terminal</i>`,
          parse_mode: "HTML"
        })
      }
    )

    const telegramResult = await telegramResponse.json()

    if (!telegramResponse.ok || !telegramResult.ok) {
      console.error("Telegram API error:", telegramResult)
      return NextResponse.json(
        { error: telegramResult.description || "Could not send test message. Check your Chat ID." },
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
