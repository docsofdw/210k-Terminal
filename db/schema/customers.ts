import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const userRole = pgEnum("user_role", ["admin", "viewer"])

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").unique().notNull(),
  name: text("name"),
  email: text("email"),
  role: userRole("role").default("viewer").notNull(),
  telegramChatId: text("telegram_chat_id"),
  telegramUsername: text("telegram_username"),
  telegramConnectedAt: timestamp("telegram_connected_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

export type InsertCustomer = typeof customers.$inferInsert
export type SelectCustomer = typeof customers.$inferSelect
