import {
  boolean,
  decimal,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core"
import { alerts, alertType, notificationChannel } from "./alerts"
import { companies } from "./companies"
import { customers } from "./customers"

export const alertHistory = pgTable("alert_history", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Foreign keys
  alertId: uuid("alert_id").notNull().references(() => alerts.id),
  userId: text("user_id").notNull().references(() => customers.userId),
  companyId: uuid("company_id").references(() => companies.id),

  // Alert details at time of trigger
  alertType: alertType("alert_type").notNull(),
  threshold: decimal("threshold", { precision: 20, scale: 8 }),
  thresholdPercent: decimal("threshold_percent", { precision: 10, scale: 4 }),

  // Actual values at trigger time
  actualValue: decimal("actual_value", { precision: 20, scale: 8 }),
  previousValue: decimal("previous_value", { precision: 20, scale: 8 }),

  // Notification delivery
  channel: notificationChannel("channel").notNull(),
  notificationSent: boolean("notification_sent").default(false).notNull(),
  notificationError: text("notification_error"),

  // Context data (JSON blob for additional info)
  context: jsonb("context"), // Stock price, mNAV, BTC price, etc.

  // Message sent
  messageTitle: text("message_title"),
  messageBody: text("message_body"),

  // Timestamp
  triggeredAt: timestamp("triggered_at").defaultNow().notNull()
})

export type InsertAlertHistory = typeof alertHistory.$inferInsert
export type SelectAlertHistory = typeof alertHistory.$inferSelect
