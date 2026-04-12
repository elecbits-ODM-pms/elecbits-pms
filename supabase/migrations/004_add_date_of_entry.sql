-- Add date_of_entry column to track when a project was entered into the system.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS date_of_entry DATE;
