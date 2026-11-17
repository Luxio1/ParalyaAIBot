CREATE TABLE `bot_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`auto_start` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
