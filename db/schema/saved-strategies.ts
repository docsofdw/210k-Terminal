import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core"
import type { SavedStrategyLeg } from "@/types/derivatives"

export const savedStrategies = pgTable("saved_strategies", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  underlying: text("underlying").notNull(),
  legs: jsonb("legs").$type<SavedStrategyLeg[]>().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

export type InsertSavedStrategy = typeof savedStrategies.$inferInsert
export type SelectSavedStrategy = typeof savedStrategies.$inferSelect
