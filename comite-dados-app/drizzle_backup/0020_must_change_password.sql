-- Migration: add mustChangePassword column to users table
ALTER TABLE `users` ADD COLUMN `mustChangePassword` boolean NOT NULL DEFAULT false;
