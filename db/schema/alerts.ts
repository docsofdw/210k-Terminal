import {
  boolean,
  decimal,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"
import { companies } from "./companies"
import { customers } from "./customers"

// Alert types
export const alertType = pgEnum("alert_type", [
  // Company-specific alerts
  "price_above",      // Stock price goes above threshold
  "price_below",      // Stock price goes below threshold
  "mnav_above",       // mNAV goes above threshold
  "mnav_below",       // mNAV goes below threshold
  "btc_holdings",     // BTC holdings change detected
  "pct_change_up",    // Price increases by X%
  "pct_change_down",  // Price decreases by X%
  // On-chain metric alerts (global Bitcoin metrics)
  "fear_greed_above",    // Fear & Greed index goes above threshold
  "fear_greed_below",    // Fear & Greed index goes below threshold
  "mvrv_above",          // MVRV Z-Score goes above threshold
  "mvrv_below",          // MVRV Z-Score goes below threshold
  "nupl_above",          // NUPL goes above threshold
  "nupl_below",          // NUPL goes below threshold
  "funding_rate_above",  // Funding rate goes above threshold
  "funding_rate_below",  // Funding rate goes below threshold
  // Daily digest
  "onchain_daily_digest" // Daily summary of on-chain metrics
])

// Notification channels
export const notificationChannel = pgEnum("notification_channel", [
  "telegram",
  "slack",
  "email"
])

// Alert status
export const alertStatus = pgEnum("alert_status", [
  "active",
  "paused",
  "triggered",
  "expired"
])

export const alerts = pgTable("alerts", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Foreign keys
  userId: text("user_id").notNull().references(() => customers.userId),
  companyId: uuid("company_id").references(() => companies.id), // Optional - can be global alerts

  // Alert configuration
  type: alertType("type").notNull(),
  threshold: decimal("threshold", { precision: 20, scale: 8 }), // The value to compare against
  thresholdPercent: decimal("threshold_percent", { precision: 10, scale: 4 }), // For percentage-based alerts

  // Notification settings
  channel: notificationChannel("channel").notNull(),
  webhookUrl: text("webhook_url"), // For Slack webhooks
  telegramChatId: text("telegram_chat_id"), // For Telegram

  // Alert behavior
  isRepeating: boolean("is_repeating").default(false).notNull(), // Trigger once or repeatedly
  cooldownMinutes: decimal("cooldown_minutes", { precision: 10, scale: 0 }), // Minutes before re-triggering

  // Status
  status: alertStatus("status").default("active").notNull(),
  lastTriggeredAt: timestamp("last_triggered_at"),
  triggerCount: decimal("trigger_count", { precision: 10, scale: 0 }).default("0"),

  // Description
  name: text("name"),
  description: text("description"),

  // Expiration
  expiresAt: timestamp("expires_at"),

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

export type InsertAlert = typeof alerts.$inferInsert
export type SelectAlert = typeof alerts.$inferSelect
