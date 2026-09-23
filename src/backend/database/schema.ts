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
  username: text("username"),
  active: integer("active").notNull().default(1),
  revision: integer("revision").notNull().default(1),
});
export const credentials = sqliteTable("credentials", {
  userId: text("user_id").primaryKey(),
  hash: text("hash").notNull(),
  mustChange: integer("must_change").notNull().default(1),
});
export const sessions = sqliteTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: text("user_id").notNull(),
    expires: integer("expires").notNull(),
    userRevision: integer("user_revision").notNull().default(1),
    credentialHash: text("credential_hash").notNull().default(""),
  },
  (t) => [index("sessions_user").on(t.userId)],
);
export const loginAttempts = sqliteTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  until: integer("until").notNull(),
});
export const userAudit = sqliteTable("user_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  target: text("target").notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  before: text("before"),
  after: text("after"),
  at: text("at").notNull(),
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
    classCc: text("class_cc").notNull().default(""),
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
export const loginHandles = sqliteTable(
  "login_handles",
  { handle: text("handle").primaryKey(), userId: text("user_id").notNull() },
  (t) => [index("login_handles_user").on(t.userId)],
);

export const catalog = sqliteTable("catalog", {
  id: text("id").primaryKey(), kind: text("kind").notNull(), code: text("code").notNull(),
  label: text("label").notNull(), internal: text("internal").notNull().default(""),
  classCc: text("class_cc").notNull().default(""), station: text("station").notNull().default(""),
  sector: text("sector").notNull().default(""), active: integer("active").notNull().default(1),
  category: text("category").notNull().default(""),
  revision: integer("revision").notNull().default(1), changedBy: text("changed_by").notNull(),
  updatedAt: text("updated_at").notNull(),
}, t => [
  uniqueIndex("catalog_product_pn").on(sql`${t.code} COLLATE NOCASE`).where(sql`${t.kind} = 'product'`),
  uniqueIndex("catalog_defect_code").on(sql`${t.code} COLLATE NOCASE`, sql`${t.station} COLLATE NOCASE`, sql`${t.sector} COLLATE NOCASE`).where(sql`${t.kind} = 'defect'`),
]);
export const catalogAudit = sqliteTable("catalog_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }), itemId: text("item_id").notNull(),
  actor: text("actor").notNull(), before: text("before"), after: text("after").notNull(), at: text("at").notNull(),
});

export const actionPlans = sqliteTable("action_plans", {
  id: text("id").primaryKey(), recordId: text("record_id").notNull().unique(),
  evidence: text("evidence").notNull(), containment: text("containment").notNull().default(""),
  rootCause: text("root_cause").notNull().default(""), correctiveAction: text("corrective_action").notNull().default(""),
  responsible: text("responsible").notNull().default(""), dueDate: text("due_date").notNull().default(""),
  status: text("status").notNull().default("open"), qualityBy: text("quality_by").notNull(),
  qualityAt: text("quality_at").notNull(), engineeringBy: text("engineering_by").notNull().default(""),
  engineeringAt: text("engineering_at").notNull().default(""), updatedAt: text("updated_at").notNull(),
  revision: integer("revision").notNull().default(1),
});
