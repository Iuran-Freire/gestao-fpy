CREATE TABLE `audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` text NOT NULL,
	`before` text NOT NULL,
	`after` text NOT NULL,
	`actor` text NOT NULL,
	`reason` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_record` ON `audit` (`record_id`);--> statement-breakpoint
CREATE TABLE `operations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ownership` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`group_key` text NOT NULL,
	`date` text NOT NULL,
	`shift` text NOT NULL,
	`line` text NOT NULL,
	`pn` text NOT NULL,
	`model` text NOT NULL,
	`quantity` integer NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL,
	`position` text NOT NULL,
	`station` text NOT NULL,
	`category` text NOT NULL,
	`author` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`revision` integer NOT NULL,
	`changed_by` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_production` ON `records` (`group_key`) WHERE "records"."kind" = 'production';--> statement-breakpoint
CREATE INDEX `records_date_id` ON `records` (`date`,`id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'operador' NOT NULL,
	`owner` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER records_revision_guard BEFORE UPDATE ON records WHEN NEW.revision != OLD.revision + 1 BEGIN SELECT RAISE(ABORT, 'revision_conflict'); END;
--> statement-breakpoint
CREATE TRIGGER records_audit AFTER UPDATE ON records BEGIN INSERT INTO audit(record_id,before,after,actor,reason,at) VALUES (OLD.id,json_object('date',OLD.date,'shift',OLD.shift,'line',OLD.line,'pn',OLD.pn,'model',OLD.model,'quantity',OLD.quantity,'code',OLD.code,'description',OLD.description,'position',OLD.position,'station',OLD.station,'category',OLD.category,'revision',OLD.revision),json_object('date',NEW.date,'shift',NEW.shift,'line',NEW.line,'pn',NEW.pn,'model',NEW.model,'quantity',NEW.quantity,'code',NEW.code,'description',NEW.description,'position',NEW.position,'station',NEW.station,'category',NEW.category,'revision',NEW.revision),NEW.changed_by,NEW.reason,NEW.updated_at); END;
