CREATE TABLE `commands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`type` text NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`prompt_template` text DEFAULT '' NOT NULL,
	`system_prompt` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commands_name_unique` ON `commands` (`name`);--> statement-breakpoint
ALTER TABLE `bot_settings` ADD `commands_seeded` integer DEFAULT false NOT NULL;