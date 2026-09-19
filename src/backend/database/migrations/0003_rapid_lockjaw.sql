ALTER TABLE `sessions` ADD `user_revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `credential_hash` text DEFAULT '' NOT NULL;