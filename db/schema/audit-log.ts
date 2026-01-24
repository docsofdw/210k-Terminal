import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { customers } from "./customers"

export const auditAction = pgEnum("audit_action", [
  "create",
  "update",
  "delete"
])

export const auditEntity = pgEnum("audit_entity", [
  "company",
  "holdings",
  "user",
  "alert",
  "portfolio"
])

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Who made the change
    userId: text("user_id").notNull(),
    userEmail: text("user_email"),

    // What was changed
    action: auditAction("action").notNull(),
    entity: auditEntity("entity").notNull(),
    entityId: uuid("entity_id"),
    entityName: text("entity_name"),

    // Change details
    changesBefore: jsonb("changes_before"),
    changesAfter: jsonb("changes_after"),
    description: text("description"),

    // Metadata
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    // Timestamp
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => [
    index("audit_log_user_id_idx").on(table.userId),
    index("audit_log_entity_idx").on(table.entity, table.entityId),
    index("audit_log_created_at_idx").on(table.createdAt)
  ]
)

export type InsertAuditLog = typeof auditLog.$inferInsert
export type SelectAuditLog = typeof auditLog.$inferSelect
