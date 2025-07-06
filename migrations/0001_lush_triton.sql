CREATE TABLE `constraint_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`constraint_type` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 5 NOT NULL,
	`parameters` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_school_constraint` ON `constraint_configurations` (`school_id`,`constraint_type`);--> statement-breakpoint
CREATE INDEX `constraint_priority_idx` ON `constraint_configurations` (`priority`);--> statement-breakpoint
CREATE TABLE `generation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`timetable_id` text NOT NULL,
	`generation_type` text NOT NULL,
	`status` text NOT NULL,
	`target_classes` text,
	`generation_time` integer,
	`error_message` text,
	`constraint_violations` text,
	`ai_model` text DEFAULT 'gemini-2.0-flash',
	`requested_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`timetable_id`) REFERENCES `timetables`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `generation_log_timetable_idx` ON `generation_logs` (`timetable_id`);--> statement-breakpoint
CREATE INDEX `generation_log_status_idx` ON `generation_logs` (`status`);--> statement-breakpoint
CREATE INDEX `generation_log_type_idx` ON `generation_logs` (`generation_type`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`description` text,
	`category` text DEFAULT 'general' NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`updated_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_settings_key_unique` ON `system_settings` (`key`);--> statement-breakpoint
CREATE INDEX `system_settings_category_idx` ON `system_settings` (`category`);--> statement-breakpoint
CREATE TABLE `timetable_history` (
	`id` text PRIMARY KEY NOT NULL,
	`timetable_id` text NOT NULL,
	`version` integer NOT NULL,
	`change_type` text NOT NULL,
	`change_description` text,
	`changed_by` text,
	`snapshot_data` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`timetable_id`) REFERENCES `timetables`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `timetable_history_version_idx` ON `timetable_history` (`timetable_id`,`version`);--> statement-breakpoint
CREATE INDEX `timetable_history_change_type_idx` ON `timetable_history` (`change_type`);--> statement-breakpoint
CREATE TABLE `user_schools` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`school_id` text NOT NULL,
	`role` text DEFAULT 'teacher' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_school` ON `user_schools` (`user_id`,`school_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`hashed_password` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'teacher' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `user_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `user_role_idx` ON `users` (`role`);--> statement-breakpoint
DROP INDEX `unique_schedule`;--> statement-breakpoint
ALTER TABLE `schedules` ADD `week_type` text DEFAULT 'all';--> statement-breakpoint
ALTER TABLE `schedules` ADD `is_substitute` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `schedules` ADD `original_schedule_id` text REFERENCES schedules(id);--> statement-breakpoint
ALTER TABLE `schedules` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `schedules` ADD `generated_by` text DEFAULT 'manual';--> statement-breakpoint
CREATE INDEX `schedule_timetable_idx` ON `schedules` (`timetable_id`);--> statement-breakpoint
CREATE INDEX `schedule_class_idx` ON `schedules` (`class_id`);--> statement-breakpoint
CREATE INDEX `schedule_teacher_idx` ON `schedules` (`teacher_id`);--> statement-breakpoint
CREATE INDEX `schedule_time_slot_idx` ON `schedules` (`day_of_week`,`period`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_schedule` ON `schedules` (`timetable_id`,`class_id`,`day_of_week`,`period`,`week_type`);--> statement-breakpoint
ALTER TABLE `classes` ADD `section` text;--> statement-breakpoint
ALTER TABLE `classes` ADD `student_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `classes` ADD `homeroom_teacher_id` text REFERENCES teachers(id);--> statement-breakpoint
ALTER TABLE `classes` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `class_grade_idx` ON `classes` (`grade`);--> statement-breakpoint
ALTER TABLE `classrooms` ADD `room_number` text;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `building` text;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `floor` integer;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `equipment` text;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `classroom_room_number_idx` ON `classrooms` (`room_number`);--> statement-breakpoint
CREATE INDEX `classroom_type_idx` ON `classrooms` (`type`);--> statement-breakpoint
ALTER TABLE `schools` ADD `type` text DEFAULT 'middle_school' NOT NULL;--> statement-breakpoint
ALTER TABLE `schools` ADD `address` text;--> statement-breakpoint
ALTER TABLE `schools` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `schools` ADD `email` text;--> statement-breakpoint
ALTER TABLE `schools` ADD `principal_name` text;--> statement-breakpoint
ALTER TABLE `schools` ADD `timezone` text DEFAULT 'Asia/Tokyo' NOT NULL;--> statement-breakpoint
ALTER TABLE `schools` ADD `settings` text;--> statement-breakpoint
ALTER TABLE `schools` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `subjects` ADD `short_name` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `subject_code` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `category` text DEFAULT 'core' NOT NULL;--> statement-breakpoint
ALTER TABLE `subjects` ADD `weekly_hours` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `subjects` ADD `requires_special_room` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `subjects` ADD `color` text DEFAULT '#3498db';--> statement-breakpoint
ALTER TABLE `subjects` ADD `settings` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `subject_code_idx` ON `subjects` (`subject_code`);--> statement-breakpoint
CREATE INDEX `subject_category_idx` ON `subjects` (`category`);--> statement-breakpoint
ALTER TABLE `teacher_subjects` ADD `qualification_level` text DEFAULT 'qualified';--> statement-breakpoint
ALTER TABLE `teacher_subjects` ADD `priority` integer DEFAULT 1;--> statement-breakpoint
CREATE INDEX `teacher_subject_priority_idx` ON `teacher_subjects` (`priority`);--> statement-breakpoint
ALTER TABLE `teachers` ADD `employee_number` text;--> statement-breakpoint
ALTER TABLE `teachers` ADD `email` text;--> statement-breakpoint
ALTER TABLE `teachers` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `teachers` ADD `specialization` text;--> statement-breakpoint
ALTER TABLE `teachers` ADD `employment_type` text DEFAULT 'full_time' NOT NULL;--> statement-breakpoint
ALTER TABLE `teachers` ADD `max_hours_per_week` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `teachers` ADD `user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `teachers` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `teacher_employee_number_idx` ON `teachers` (`employee_number`);--> statement-breakpoint
CREATE INDEX `teacher_user_idx` ON `teachers` (`user_id`);--> statement-breakpoint
ALTER TABLE `timetables` ADD `description` text;--> statement-breakpoint
ALTER TABLE `timetables` ADD `academic_year` text NOT NULL;--> statement-breakpoint
ALTER TABLE `timetables` ADD `term` text NOT NULL;--> statement-breakpoint
ALTER TABLE `timetables` ADD `start_date` text NOT NULL;--> statement-breakpoint
ALTER TABLE `timetables` ADD `end_date` text NOT NULL;--> statement-breakpoint
ALTER TABLE `timetables` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `timetables` ADD `status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `timetables` ADD `created_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `timetables` ADD `approved_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `timetables` ADD `approved_at` text;--> statement-breakpoint
ALTER TABLE `timetables` ADD `settings` text;--> statement-breakpoint
CREATE INDEX `timetable_status_idx` ON `timetables` (`status`);--> statement-breakpoint
CREATE INDEX `timetable_academic_year_idx` ON `timetables` (`academic_year`);--> statement-breakpoint
CREATE INDEX `timetable_active_idx` ON `timetables` (`is_active`);