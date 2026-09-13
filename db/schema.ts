import {
  integer,
  sqliteTable,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("operador"),
  owner: integer("owner").notNull().default(0),
});
export const ownership = sqliteTable("ownership", {
  id: integer("id").primaryKey(),
  userId: text("user_id").notNull(),
});
export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    groupKey: text("group_key").notNull(),
    date: text("date").notNull(),
    shift: text("shift").notNull(),
    line: text("line").notNull(),
    pn: text("pn").notNull(),
    model: text("model").notNull(),
    quantity: integer("quantity").notNull(),
    code: text("code").notNull(),
    description: text("description").notNull(),
    position: text("position").notNull(),
    station: text("station").notNull(),
    category: text("category").notNull(),
    author: text("author").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    revision: integer("revision").notNull(),
    changedBy: text("changed_by").notNull(),
    reason: text("reason").notNull().default(""),
  },
  (t) => [
    uniqueIndex("unique_production")
      .on(t.groupKey)
      .where(sql`${t.kind} = 'production'`),
    index("records_date_id").on(t.date, t.id),
  ],
);
export const operations = sqliteTable("operations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
});
export const audit = sqliteTable(
  "audit",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recordId: text("record_id").notNull(),
    before: text("before").notNull(),
    after: text("after").notNull(),
    actor: text("actor").notNull(),
    reason: text("reason").notNull(),
    at: text("at").notNull(),
  },
  (t) => [index("audit_record").on(t.recordId)],
);
