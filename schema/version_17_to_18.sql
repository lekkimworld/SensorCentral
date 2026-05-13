-- Add SMARTME_CLIENTCREDENTIALS to the authenticator template enum
ALTER TYPE CALLOUT_AUTHENTICATOR_TEMPLATE ADD VALUE 'SMARTME_CLIENTCREDENTIALS';

-- Drop existing powermeter subscriptions (old ciphertext-based auth is incompatible)
DELETE FROM powermeter_subscription;

-- Replace ciphertext column with calloutid FK
ALTER TABLE powermeter_subscription DROP COLUMN ciphertext;
ALTER TABLE powermeter_subscription ADD COLUMN calloutid character varying(36) NOT NULL;
ALTER TABLE powermeter_subscription ADD FOREIGN KEY (calloutid) REFERENCES callout(id) ON DELETE CASCADE;

UPDATE DATABASE_VERSION SET version=18;
