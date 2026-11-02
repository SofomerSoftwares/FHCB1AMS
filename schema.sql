-- ==============================================================================
-- FHC Branch One Physical Archive & Document Tracking System
-- MySQL / MySQLi Relational Schema Definition
-- Compatible with MySQL 5.7+, MySQL 8.0+, MariaDB 10+, and phpMyAdmin
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `archivetrack_ethiopia`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `archivetrack_ethiopia`;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS `departments` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `code` VARCHAR(32) NOT NULL UNIQUE,
  `name_en` VARCHAR(255) NOT NULL,
  `name_am` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `manager_id` VARCHAR(64) DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_dept_code` (`code`),
  INDEX `idx_dept_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Institutional Staff & User Accounts
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `username` VARCHAR(64) NOT NULL UNIQUE,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `full_name` VARCHAR(255) NOT NULL,
  `amharic_name` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'EMPLOYEE', 'AUDITOR') NOT NULL,
  `department_id` VARCHAR(64) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `password_hash` VARCHAR(255) NOT NULL,
  `employee_id` VARCHAR(64) DEFAULT NULL,
  `phone` VARCHAR(64) DEFAULT NULL,
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_dept` (`department_id`),
  FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Physical Archive Storage Locations (Building, Room, Shelf, Box)
CREATE TABLE IF NOT EXISTS `archive_locations` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `code` VARCHAR(64) NOT NULL UNIQUE,
  `name_en` VARCHAR(255) NOT NULL,
  `name_am` VARCHAR(255) NOT NULL,
  `type` ENUM('BUILDING', 'ROOM', 'CABINET', 'SHELF', 'BOX') NOT NULL,
  `parent_id` VARCHAR(64) DEFAULT NULL,
  `department_id` VARCHAR(64) DEFAULT NULL,
  `shelf_number` VARCHAR(32) DEFAULT NULL,
  `box_number` VARCHAR(32) DEFAULT NULL,
  `full_path` VARCHAR(500) DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_loc_code` (`code`),
  INDEX `idx_loc_type` (`type`),
  INDEX `idx_loc_shelf` (`shelf_number`),
  INDEX `idx_loc_box` (`box_number`),
  INDEX `idx_loc_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Physical Archive Documents & Historical Kebele/Woreda Coordinates
CREATE TABLE IF NOT EXISTS `documents` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `reference_number` VARCHAR(128) NOT NULL UNIQUE,
  `title_en` VARCHAR(255) NOT NULL,
  `title_am` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `category` ENUM('COMMERCIAL', 'RESIDENT') NOT NULL,
  `old_woreda` VARCHAR(32) DEFAULT NULL,
  `old_kebele` VARCHAR(32) DEFAULT NULL,
  `house_number` VARCHAR(64) DEFAULT NULL,
  `shelf_number` VARCHAR(32) DEFAULT NULL,
  `box_number` VARCHAR(32) DEFAULT NULL,
  `department_id` VARCHAR(64) NOT NULL,
  `document_date` DATE NOT NULL,
  `registration_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confidentiality` ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET') NOT NULL DEFAULT 'INTERNAL',
  `retention_date` DATE DEFAULT NULL,
  `current_location_id` VARCHAR(64) NOT NULL,
  `current_holder_id` VARCHAR(64) DEFAULT NULL,
  `status` ENUM('AVAILABLE', 'BORROWED', 'RESERVED', 'IN_TRANSIT', 'MISSING', 'ARCHIVED', 'DECOMMISSIONED') NOT NULL DEFAULT 'AVAILABLE',
  `qr_identifier` VARCHAR(191) NOT NULL UNIQUE,
  `registration_officer_id` VARCHAR(64) NOT NULL,
  `page_count` INT UNSIGNED DEFAULT 15,
  `condition_notes` TEXT,
  `tags` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_doc_ref` (`reference_number`),
  INDEX `idx_doc_cat` (`category`),
  INDEX `idx_doc_status` (`status`),
  INDEX `idx_doc_woreda` (`old_woreda`),
  INDEX `idx_doc_kebele` (`old_kebele`),
  INDEX `idx_doc_house` (`house_number`),
  INDEX `idx_doc_shelf` (`shelf_number`),
  INDEX `idx_doc_box` (`box_number`),
  INDEX `idx_doc_loc` (`current_location_id`),
  INDEX `idx_doc_holder` (`current_holder_id`),
  FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`),
  FOREIGN KEY (`current_location_id`) REFERENCES `archive_locations` (`id`),
  FOREIGN KEY (`current_holder_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`registration_officer_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Document Borrow Requisitions & Multi-Level Review
CREATE TABLE IF NOT EXISTS `document_requests` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `request_number` VARCHAR(64) NOT NULL UNIQUE,
  `document_id` VARCHAR(64) NOT NULL,
  `requester_id` VARCHAR(64) NOT NULL,
  `purpose` TEXT NOT NULL,
  `request_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `requested_return_date` DATE NOT NULL,
  `approved_return_date` DATE DEFAULT NULL,
  `actual_return_date` DATETIME DEFAULT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'ISSUED', 'RETURNED', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `priority` ENUM('LOW', 'NORMAL', 'URGENT', 'CRITICAL') NOT NULL DEFAULT 'NORMAL',
  `manager_id` VARCHAR(64) DEFAULT NULL,
  `manager_decision_at` DATETIME DEFAULT NULL,
  `manager_notes` TEXT,
  `issued_by_officer_id` VARCHAR(64) DEFAULT NULL,
  `issued_at` DATETIME DEFAULT NULL,
  `returned_to_officer_id` VARCHAR(64) DEFAULT NULL,
  `handover_notes` TEXT,
  `return_condition` TEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_req_status` (`status`),
  INDEX `idx_req_doc` (`document_id`),
  INDEX `idx_req_user` (`requester_id`),
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`requester_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Append-Only Physical File Movements (Chain of Custody)
CREATE TABLE IF NOT EXISTS `file_movements` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `document_id` VARCHAR(64) NOT NULL,
  `movement_type` ENUM('REGISTRATION', 'CHECK_OUT', 'CHECK_IN', 'RELOCATION', 'INVESTIGATION', 'DISPOSAL', 'AUDIT_TRANSFER') NOT NULL,
  `previous_location_id` VARCHAR(64) DEFAULT NULL,
  `new_location_id` VARCHAR(64) DEFAULT NULL,
  `previous_holder_id` VARCHAR(64) DEFAULT NULL,
  `new_holder_id` VARCHAR(64) DEFAULT NULL,
  `acting_user_id` VARCHAR(64) NOT NULL,
  `request_id` VARCHAR(64) DEFAULT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` TEXT,
  `shelf_delta` VARCHAR(128) DEFAULT NULL,
  `box_delta` VARCHAR(128) DEFAULT NULL,
  INDEX `idx_mov_doc` (`document_id`),
  INDEX `idx_mov_time` (`timestamp`),
  INDEX `idx_mov_actor` (`acting_user_id`),
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`acting_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Forensic Audit Logs
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `username` VARCHAR(64) NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `entity_type` VARCHAR(64) NOT NULL,
  `entity_id` VARCHAR(64) NOT NULL,
  `details` TEXT NOT NULL,
  `ip_address` VARCHAR(64) DEFAULT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_user` (`user_id`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_time` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Missing File Security Investigations
CREATE TABLE IF NOT EXISTS `missing_file_investigations` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `document_id` VARCHAR(64) NOT NULL,
  `investigation_number` VARCHAR(64) NOT NULL UNIQUE,
  `status` ENUM('OPEN', 'UNDER_INVESTIGATION', 'RESOLVED_FOUND', 'DECLARED_LOST', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `initial_note` TEXT NOT NULL,
  `reported_by_id` VARCHAR(64) NOT NULL,
  `reported_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolution_notes` TEXT,
  `resolved_at` DATETIME DEFAULT NULL,
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. In-App Notifications
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `title_en` VARCHAR(255) NOT NULL,
  `title_am` VARCHAR(255) NOT NULL,
  `message_en` TEXT NOT NULL,
  `message_am` TEXT NOT NULL,
  `type` ENUM('INFO', 'SUCCESS', 'WARNING', 'ALERT', 'OVERDUE') NOT NULL DEFAULT 'INFO',
  `read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notif_user` (`user_id`, `read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
