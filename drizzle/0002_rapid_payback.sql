CREATE TABLE `login_handles` (
	`handle` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_handles_user` ON `login_handles` (`user_id`);--> statement-breakpoint
CREATE TRIGGER users_revision_guard BEFORE UPDATE ON users WHEN NEW.revision != OLD.revision + 1 BEGIN SELECT RAISE(ABORT, 'revision_conflict'); END;
