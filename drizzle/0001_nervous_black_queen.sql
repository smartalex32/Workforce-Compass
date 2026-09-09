CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_org_date` ON `audit_events` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `compensation_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`captured_at` text NOT NULL,
	`data_json` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_compensation_snapshots_org_date` ON `compensation_snapshots` (`organization_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `planning_profiles` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`state_json` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `salary_history` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`previous_salary` real NOT NULL,
	`new_salary` real NOT NULL,
	`effective_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_salary_history_employee_date` ON `salary_history` (`employee_id`,`effective_at`);--> statement-breakpoint
ALTER TABLE `employees` ADD `employee_number` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `annual_bonus` real;--> statement-breakpoint
ALTER TABLE `employees` ADD `annual_equity` real;--> statement-breakpoint
ALTER TABLE `employees` ADD `annual_benefits` real;--> statement-breakpoint
ALTER TABLE `employees` ADD `location` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `start_date` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `team` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `manager_id` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `performance_rating` real;