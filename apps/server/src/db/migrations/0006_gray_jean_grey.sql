CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`behavior` text DEFAULT '{}' NOT NULL,
	`command_ids` text DEFAULT '[]' NOT NULL,
	`event_rule_ids` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_name_unique` ON `profiles` (`name`);--> statement-breakpoint
ALTER TABLE `bot_settings` ADD `active_profile_id` integer;--> statement-breakpoint
-- Les réglages, commandes et règles actives en place deviennent le profil « Normal ».
INSERT INTO `profiles` (`name`, `behavior`, `command_ids`, `event_rule_ids`) VALUES (
	'Normal',
	COALESCE((SELECT `config` FROM `bot_settings` WHERE `id` = 1), '{}'),
	(SELECT json_group_array(`id`) FROM `commands` WHERE `enabled` = 1),
	(SELECT json_group_array(`id`) FROM `event_rules` WHERE json_extract(`definition`, '$.enabled') = 1)
);--> statement-breakpoint
ALTER TABLE `commands` DROP COLUMN `enabled`;