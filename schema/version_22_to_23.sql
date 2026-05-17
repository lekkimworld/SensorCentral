-- Drop legacy powermeter subscription table (replaced by cron_job)
DROP TABLE IF EXISTS powermeter_subscription;

-- Add system_managed flag to callout infra tables
ALTER TABLE callout_secret ADD COLUMN IF NOT EXISTS system_managed boolean NOT NULL DEFAULT false;
ALTER TABLE callout_endpoint ADD COLUMN IF NOT EXISTS system_managed boolean NOT NULL DEFAULT false;
ALTER TABLE callout_authenticator ADD COLUMN IF NOT EXISTS system_managed boolean NOT NULL DEFAULT false;
ALTER TABLE callout ADD COLUMN IF NOT EXISTS system_managed boolean NOT NULL DEFAULT false;

-- Create cron_job type and table
CREATE TYPE cron_job_type AS ENUM ('smartme_powermeter');

CREATE TABLE cron_job (
    id character varying(36) NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    userid character varying(36) NOT NULL,
    job_type cron_job_type NOT NULL,
    active boolean NOT NULL DEFAULT true,
    frequency_minutes integer NOT NULL DEFAULT 5,
    config jsonb NOT NULL DEFAULT '{}',
    callout_id character varying(36),
    sensor_id character varying(36),
    house_id character varying(36)
);
ALTER TABLE cron_job ADD FOREIGN KEY (userid) REFERENCES login_user(id) ON DELETE CASCADE;
ALTER TABLE cron_job ADD FOREIGN KEY (callout_id) REFERENCES callout(id) ON DELETE SET NULL;
ALTER TABLE cron_job ADD FOREIGN KEY (sensor_id) REFERENCES sensor(id) ON DELETE CASCADE;
ALTER TABLE cron_job ADD FOREIGN KEY (house_id) REFERENCES house(id) ON DELETE CASCADE;

UPDATE database_version SET version=23;
