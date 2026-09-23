-- One-time upgrade for the Cloudflare D1 database that received the original
-- September 20 action_plans schema. Keep the legacy table intact for audit.
-- Do not run this file on a fresh database using migration 0005_action_plans.sql.
ALTER TABLE action_plans RENAME TO action_plans_legacy;

CREATE TABLE action_plans (
 id TEXT PRIMARY KEY NOT NULL,
 record_id TEXT NOT NULL UNIQUE,
 evidence TEXT NOT NULL,
 containment TEXT NOT NULL DEFAULT '',
 root_cause TEXT NOT NULL DEFAULT '',
 corrective_action TEXT NOT NULL DEFAULT '',
 responsible TEXT NOT NULL DEFAULT '',
 due_date TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','completed')),
 quality_by TEXT NOT NULL,
 quality_at TEXT NOT NULL,
 engineering_by TEXT NOT NULL DEFAULT '',
 engineering_at TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 FOREIGN KEY(record_id) REFERENCES records(id)
);
