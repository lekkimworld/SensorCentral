declare global {
    namespace NodeJS {
        interface ProcessEnv {
            // heroku
            PORT?: string;

            /**
             * Log level - one of TRACE, DEBUG, INFO, WARN, ERROR
             */
            LOG_LEVEL: "trace" | "debug" | "info" | "warn" | "error" | undefined;

            /**
             * URL for Postgres database
             */
            DATABASE_URL: string;

            /**
             * Use TLS for database connection. Also requires NODE_ENV to be set to production.
             */
            DATABASE_SSL: string;

            /**
             * Set to allow database to init / upgrade database schema
             */
            DATABASE_ALLOW_SCHEMA_UPGRADE: string;
            
            /**
             * Set to ALWAYS rollback schema upgrade and throw exception. Used for testing.
             */
            DATABASE_ALWAYS_ROLLBACK_SCHEMA_UPGRADE: string;

            /**
             * URL for rabbitmq
             */
            CLOUDAMQP_URL: string;

            /**
             * URL for Redis
             */
            REDIS_URL: string;
            /**
             * TLS URL for Redis
             */
            REDIS_TLS_URL?: string;

            /**
             * Timeout in milliseconds within which Redis must respond
             */
            REDIS_CONNECTION_TIMEOUT: string;

            // express
            NODE_ENV: "staging" | "development" | "production";

            // sensorcentral

            /**
             * If set do not add cron job for powermeter subscription on startup or when new subscriptions are created
             */
            CRON_POWERMETER_SUBSCRIPTIONS_DISABLED: string;

            /**
             * If set do not send notifications using email or Pushover no matter what
             */
            NOTIFICATIONS_DISABLED: string;

            /**
             * Send all notifications to this email.
             */
            NOTIFICATIONS_EMAIL_OVERRIDE: string;

            /**
             * Domain the app is running on
             */
            APP_DOMAIN: string;

            /**
             * If set we do not send the user to TLS if NODE_ENV is production
             */
            APP_NO_PROD_TLS: string;

            /**
             * Protocol the app is hosted on (defaults to https)
             */
            APP_PROTOCOL: "http" | "https";

            /**
             * The commit the build was made from if any
             */
            APP_GITCOMMIT: string;

            /**
             * Secret used to sign / verify JWT's issued by the app
             */
            API_JWT_SECRET: string;

            /**
             * Issuer of JWT tokens from the app (defaults to https://sensorcentral.heisterberg.dk).
             */
            API_JWT_ISSUER: string | undefined;

            /**
             * Audience of JWT tokens from the app (defaults to https://sensorcentral.heisterberg.dk)
             */
            API_JWT_AUDIENCE: string | undefined;

            /**
             * Only allow logins from this domain using OIDC if set
             */
            GOOGLE_HOSTED_DOMAIN: string;

            /**
             * Private key used to sign JWT's used when sending email through gmail
             */
            GOOGLE_PRIVATE_KEY: string;

            /**
             * Service account used when sending email through gmail
             */
            GOOGLE_SERVICE_ACCOUNT_EMAIL: string;

            /**
             * Token URI for Google services
             */
            GOOGLE_TOKEN_URI: string;

            OIDC_CLIENT_ID: string;
            OIDC_CLIENT_SECRET: string;
            OIDC_PROVIDER_URL: string;
            OIDC_REDIRECT_URI: string;

            /**
             * Session secret
             */
            SESSION_SECRET: string;

            /**
             * Session timeout  - default is 300 seconds
             */
            SESSION_TIMEOUT_SECONDS: string;

            /**
             * Key used to encrypt smart-me data in the database.
             */
            SMARTME_KEY: !string;
            /**
             * Domain for smart-me api (defaults to api.smart-me.com)
             */
            SMARTME_DOMAIN: string;
            /**
             * Protocol to use when contacting smart-me (defaults to https)
             */
            SMARTME_PROTOCOL: "http" | "https";

            /**
             * Path on which to host GraphQL endpoint (defaults to /graphql)
             */
            GRAPHQL_PATH?: string;

            /**
             * Should we just disable binary sensor timeouts.
             *
             */
            ALERTS_BINARY_SENSOR_DISABLE: string;

            /**
             * Timeout in milliseonds to override default timeout of 10 minutes
             */
            TIMEOUT_BINARY_SENSOR: string;
        }
    }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {};
