ALTER TABLE `organizations` ADD `workspace_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `offices` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`labor_market_id` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`labor_market_id`) REFERENCES `labor_markets`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `idx_offices_organization_id` ON `offices` (`organization_id`);--> statement-breakpoint
ALTER TABLE `levels` ADD `code` text;--> statement-breakpoint
UPDATE `levels` SET `code` = `name`;--> statement-breakpoint
ALTER TABLE `levels` ADD `is_retired` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `employees_next` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_number` text,
	`organization_id` text NOT NULL,
	`office_id` text,
	`discipline_id` text,
	`career_ladder_id` text,
	`level_id` text,
	`name` text NOT NULL,
	`title` text,
	`base_salary` real,
	`annual_bonus` real,
	`annual_equity` real,
	`annual_benefits` real,
	`location` text,
	`start_date` text,
	`team` text,
	`manager_id` text,
	`performance_rating` real,
	`notes` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`discipline_id`) REFERENCES `disciplines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`career_ladder_id`) REFERENCES `career_ladders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE restrict
);--> statement-breakpoint
INSERT INTO `employees_next` (`id`,`employee_number`,`organization_id`,`discipline_id`,`career_ladder_id`,`level_id`,`name`,`title`,`base_salary`,`annual_bonus`,`annual_equity`,`annual_benefits`,`location`,`start_date`,`team`,`manager_id`,`performance_rating`,`notes`)
SELECT `id`,`employee_number`,`organization_id`,`discipline_id`,`career_ladder_id`,`level_id`,`name`,`title`,`base_salary`,`annual_bonus`,`annual_equity`,`annual_benefits`,`location`,`start_date`,`team`,`manager_id`,`performance_rating`,`notes` FROM `employees`;--> statement-breakpoint
DROP TABLE `employees`;--> statement-breakpoint
ALTER TABLE `employees_next` RENAME TO `employees`;--> statement-breakpoint
CREATE INDEX `idx_employees_analysis_scope` ON `employees` (`organization_id`,`discipline_id`,`career_ladder_id`,`level_id`);--> statement-breakpoint
CREATE INDEX `idx_employees_office_id` ON `employees` (`office_id`);--> statement-breakpoint
CREATE TABLE `market_compensation_next` (
	`id` text PRIMARY KEY NOT NULL,
	`dataset_id` text NOT NULL,
	`discipline_id` text NOT NULL,
	`career_ladder_id` text NOT NULL,
	`level_id` text NOT NULL,
	`p25` real,
	`p50` real NOT NULL,
	`p75` real,
	`p90` real,
	FOREIGN KEY (`dataset_id`) REFERENCES `market_datasets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`discipline_id`) REFERENCES `disciplines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`career_ladder_id`) REFERENCES `career_ladders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `market_compensation_next` SELECT * FROM `market_compensation`;--> statement-breakpoint
DROP TABLE `market_compensation`;--> statement-breakpoint
ALTER TABLE `market_compensation_next` RENAME TO `market_compensation`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_market_compensation_scope` ON `market_compensation` (`dataset_id`,`discipline_id`,`career_ladder_id`,`level_id`);--> statement-breakpoint
CREATE TABLE `pay_band_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`level_id` text NOT NULL,
	`labor_market_id` text,
	`effective_date` text NOT NULL,
	`minimum` real,
	`midpoint` real,
	`maximum` real,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`labor_market_id`) REFERENCES `labor_markets`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_pay_band_versions_scope` ON `pay_band_versions` (`organization_id`,`level_id`,IFNULL(`labor_market_id`,''),`effective_date`);--> statement-breakpoint
CREATE INDEX `idx_pay_band_versions_lookup` ON `pay_band_versions` (`organization_id`,`level_id`,`labor_market_id`,`effective_date`);--> statement-breakpoint
CREATE TABLE `survey_import_mappings` (
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`mapping_json` text NOT NULL,
	PRIMARY KEY (`organization_id`,`name`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE TRIGGER `audit_events_workspace_revision`
AFTER INSERT ON `audit_events`
BEGIN
  UPDATE `organizations` SET `workspace_revision` = `workspace_revision` + 1 WHERE `id` = NEW.`organization_id`;
END;
