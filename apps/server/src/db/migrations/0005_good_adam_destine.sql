CREATE TABLE `event_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`definition` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `bot_settings` ADD `events_seeded` integer DEFAULT false NOT NULL;