"use server"

import { db } from "@/db"
import { customers } from "@/db/schema/customers"
import { eq } from "drizzle-orm"
import { requireAuth } from "@/lib/auth/permissions"
import { sendTelegramMessage } from "@/lib/notifications/telegram"

export async function connectTelegram(
  chatId: string
): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    const user = await requireAuth()

    // Validate chat ID format (should be a number)
    if (!/^\d+$/.test(chatId)) {
      return { isSuccess: false, error: "Invalid Chat ID format" }
    }

    // Send a test message to verify the chat ID works
    const testResult = await sendTelegramMessage({
      chatId,
      text: `✅ <b>Telegram Connected!</b>

Your 210k Terminal account is now linked.

You'll receive alerts for:
• Price threshold breaches
• mNAV changes
• BTC holdings updates

<i>210k Terminal</i>`
    })

    if (!testResult.success) {
      return {
        isSuccess: false,
        error: "Could not send test message. Please check your Chat ID and make sure you've messaged the bot first."
      }
    }

    // Save to database
    await db
      .update(customers)
      .set({
        telegramChatId: chatId,
        telegramConnectedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(customers.userId, user.userId))

    return { isSuccess: true }
  } catch (error) {
    console.error("Error connecting Telegram:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export async function disconnectTelegram(): Promise<{ isSuccess: boolean; error?: string }> {
  try {
    const user = await requireAuth()

    await db
      .update(customers)
      .set({
        telegramChatId: null,
        telegramUsername: null,
        telegramConnectedAt: null,
        updatedAt: new Date()
      })
      .where(eq(customers.userId, user.userId))

    return { isSuccess: true }
  } catch (error) {
    console.error("Error disconnecting Telegram:", error)
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export async function getCurrentUser() {
  try {
    const user = await requireAuth()

    const customer = await db.query.customers.findFirst({
      where: eq(customers.userId, user.userId)
    })

    return customer
  } catch {
    return null
  }
}
