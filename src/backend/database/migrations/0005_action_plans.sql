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
