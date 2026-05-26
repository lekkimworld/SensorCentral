-- Add device_id column to cron_job
ALTER TABLE cron_job ADD COLUMN device_id character varying(36);
ALTER TABLE cron_job ADD FOREIGN KEY (device_id) REFERENCES device(id) ON DELETE CASCADE;

-- Add 'callout' to cron_job_type enum
ALTER TYPE cron_job_type ADD VALUE 'callout';

UPDATE database_version SET version=24;
