ALTER TABLE catalog ADD category TEXT NOT NULL DEFAULT '';
UPDATE catalog SET category=sector WHERE kind='defect' AND category='';

DROP TRIGGER catalog_insert_audit;
DROP TRIGGER catalog_update_audit;
CREATE TRIGGER catalog_insert_audit AFTER INSERT ON catalog BEGIN
 INSERT INTO catalog_audit(item_id,actor,before,after,at) VALUES(NEW.id,NEW.changed_by,NULL,
 json_object('kind',NEW.kind,'code',NEW.code,'label',NEW.label,'internal',NEW.internal,'classCc',NEW.class_cc,'station',NEW.station,'sector',NEW.sector,'category',NEW.category,'active',NEW.active,'revision',NEW.revision),NEW.updated_at);
END;
CREATE TRIGGER catalog_update_audit AFTER UPDATE ON catalog BEGIN
 INSERT INTO catalog_audit(item_id,actor,before,after,at) VALUES(NEW.id,NEW.changed_by,
 json_object('kind',OLD.kind,'code',OLD.code,'label',OLD.label,'internal',OLD.internal,'classCc',OLD.class_cc,'station',OLD.station,'sector',OLD.sector,'category',OLD.category,'active',OLD.active,'revision',OLD.revision),
 json_object('kind',NEW.kind,'code',NEW.code,'label',NEW.label,'internal',NEW.internal,'classCc',NEW.class_cc,'station',NEW.station,'sector',NEW.sector,'category',NEW.category,'active',NEW.active,'revision',NEW.revision),NEW.updated_at);
END;

CREATE TABLE action_plans (
 id TEXT PRIMARY KEY NOT NULL,
 date TEXT NOT NULL,
 shift TEXT NOT NULL CHECK(shift IN ('1','2','3')),
 line TEXT NOT NULL,
 pn TEXT NOT NULL,
 model TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity > 0),
 defect_code TEXT NOT NULL,
 defect_description TEXT NOT NULL,
 category TEXT NOT NULL,
 position TEXT NOT NULL DEFAULT '',
 evidence TEXT NOT NULL,
 containment TEXT NOT NULL DEFAULT '',
 root_cause TEXT NOT NULL DEFAULT '',
 corrective_action TEXT NOT NULL DEFAULT '',
 verification TEXT NOT NULL DEFAULT '',
 responsible TEXT NOT NULL DEFAULT '',
 due_date TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'aberto' CHECK(status IN ('aberto','em_analise','concluido')),
 opened_by TEXT NOT NULL,
 engineering_by TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 completed_at TEXT,
 revision INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX action_plans_status_date ON action_plans(status,date);
CREATE INDEX action_plans_defect ON action_plans(defect_code);
CREATE TABLE action_plan_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 plan_id TEXT NOT NULL,
 actor TEXT NOT NULL,
 before TEXT,
 after TEXT NOT NULL,
 at TEXT NOT NULL
);
CREATE INDEX action_plan_audit_plan ON action_plan_audit(plan_id);
