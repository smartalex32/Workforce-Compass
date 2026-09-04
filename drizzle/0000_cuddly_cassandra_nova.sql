CREATE TABLE `career_ladders` (
	`id` text PRIMARY KEY NOT NULL,
	`discipline_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	FOREIGN KEY (`discipline_id`) REFERENCES `disciplines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_career_ladders_discipline_id` ON `career_ladders` (`discipline_id`);--> statement-breakpoint
CREATE TABLE `disciplines` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_disciplines_organization_id` ON `disciplines` (`organization_id`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`discipline_id` text NOT NULL,
	`career_ladder_id` text NOT NULL,
	`level_id` text NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`base_salary` real NOT NULL,
	`notes` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`discipline_id`) REFERENCES `disciplines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`career_ladder_id`) REFERENCES `career_ladders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_employees_analysis_scope` ON `employees` (`organization_id`,`discipline_id`,`career_ladder_id`,`level_id`);--> statement-breakpoint
CREATE TABLE `hiring_assumptions` (
	`id` text PRIMARY KEY NOT NULL,
	`discipline_id` text NOT NULL,
	`career_ladder_id` text NOT NULL,
	`level_id` text NOT NULL,
	`time_to_hire_days` integer,
	`ramp_days` integer,
	`vacancy_multiplier` real,
	`ramp_loss_factor` real,
	`recruiting_cost` real,
	`interview_cost` real,
	`signing_cost` real,
	`other_cost` real,
	FOREIGN KEY (`discipline_id`) REFERENCES `disciplines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`career_ladder_id`) REFERENCES `career_ladders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_hiring_assumptions_scope` ON `hiring_assumptions` (`discipline_id`,`career_ladder_id`,`level_id`);--> statement-breakpoint
CREATE TABLE `labor_markets` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_labor_markets_organization_id` ON `labor_markets` (`organization_id`);--> statement-breakpoint
CREATE TABLE `levels` (
	`id` text PRIMARY KEY NOT NULL,
	`career_ladder_id` text NOT NULL,
	`name` text NOT NULL,
	`ordering_value` real NOT NULL,
	`description` text,
	FOREIGN KEY (`career_ladder_id`) REFERENCES `career_ladders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_levels_ladder_order` ON `levels` (`career_ladder_id`,`ordering_value`);--> statement-breakpoint
CREATE TABLE `market_compensation` (
	`id` text PRIMARY KEY NOT NULL,
	`dataset_id` text NOT NULL,
	`discipline_id` text NOT NULL,
	`career_ladder_id` text NOT NULL,
	`level_id` text NOT NULL,
	`p25` real NOT NULL,
	`p50` real NOT NULL,
	`p75` real NOT NULL,
	`p90` real,
	FOREIGN KEY (`dataset_id`) REFERENCES `market_datasets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`discipline_id`) REFERENCES `disciplines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`career_ladder_id`) REFERENCES `career_ladders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_market_compensation_scope` ON `market_compensation` (`dataset_id`,`discipline_id`,`career_ladder_id`,`level_id`);--> statement-breakpoint
CREATE TABLE `market_datasets` (
	`id` text PRIMARY KEY NOT NULL,
	`labor_market_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`effective_date` text,
	`source` text,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`labor_market_id`) REFERENCES `labor_markets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_market_datasets_labor_market_id` ON `market_datasets` (`labor_market_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`default_labor_market_id` text,
	`currency` text DEFAULT 'USD' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
