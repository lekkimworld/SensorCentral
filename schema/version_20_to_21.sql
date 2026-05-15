ALTER TABLE callout ADD COLUMN IF NOT EXISTS content_type character varying(64) DEFAULT 'application/json';
UPDATE database_version SET version=21;
