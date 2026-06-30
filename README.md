# SensorCentral
Application I use with my family to gather telemetry and sensor data from our houses.

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection URL |
| `REDIS_URL` | Redis connection URL |
| `API_JWT_SECRET` | Secret used to sign and verify JWTs issued by the app |
| `SESSION_SECRET` | Secret for signing session cookies |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `APP_DOMAIN` | Domain the app is running on |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | — | SMTP server hostname. If unset, email sending is disabled |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_SECURE` | — | Set to `true` to use TLS for SMTP connection |
| `SMTP_USER` | — | SMTP authentication username (omit for unauthenticated relay) |
| `SMTP_PASS` | — | SMTP authentication password |
| `SMTP_FROM` | — | From address for all outgoing emails (overrides message-level from) |
| `PORT` | `8080` | Port the web server listens on |
| `NODE_ENV` | — | Environment: `development`, `staging`, or `production` |
| `LOG_LEVEL` | `info` | Log level: `trace`, `debug`, `info`, `warn`, `error` |
| `LOG_LEVEL_LOGGERS` | — | Per-logger log levels, format: `LOGGER_NAME=LEVEL,LOGGER_NAME=LEVEL` |
| `DATABASE_SSL` | — | Enable TLS for database connection (also requires `NODE_ENV=production`) |
| `DATABASE_POOL_MAX` | `20` | Maximum number of connections in the PostgreSQL pool |
| `DATABASE_ALLOW_SCHEMA_UPGRADE` | — | Allow database schema init/upgrade on startup |
| `DATABASE_ALWAYS_ROLLBACK_SCHEMA_UPGRADE` | — | Always rollback schema upgrades and throw (for testing) |
| `REDIS_TLS_URL` | — | TLS URL for Redis (used instead of `REDIS_URL` when set) |
| `REDIS_CONNECTION_TIMEOUT` | — | Timeout in milliseconds for Redis responses |
| `REDIS_DEVICE_EXPIRATION_SECS` | `1200` | Cache TTL for device data in Redis |
| `REDIS_SENSOR_EXPIRATION_SECS` | `1200` | Cache TTL for sensor data in Redis |
| `REDIS_LOGINUSER_EXPIRATION_SECS` | `28800` | Cache TTL for login user sessions in Redis |
| `REDIS_POWERDATA_EXPIRATION_SECS` | `604800` | Cache TTL for power data in Redis |
| `APP_PROTOCOL` | `https` | Protocol the app is hosted on |
| `APP_NO_PROD_TLS` | — | If set to `true`, skip TLS redirect even in production |
| `APP_GITCOMMIT` | `n_a` | Git commit hash of the build |
| `APP_VERSION` | `n_a` | App version string from the build |
| `APP_TITLE` | `SensorCentral` | Title shown in the browser |
| `API_JWT_ISSUER` | `https://sensorcentral.heisterberg.dk` | Issuer claim for JWTs |
| `API_JWT_AUDIENCE` | `https://sensorcentral.heisterberg.dk` | Audience claim for JWTs |
| `SMARTME_DOMAIN` | `api.smart-me.com` | Domain for Smart-Me API |
| `SMARTME_PROTOCOL` | `https` | Protocol for Smart-Me API |
| `SMARTME_CUTOFF_YEAR` | `2015` | Ignore Smart-Me data before this year |
| `GRAPHQL_PATH` | `/graphql` | Path for the GraphQL endpoint |
| `SESSION_TIMEOUT_SECONDS` | `300` | Session timeout in seconds |
| `SERVICE_LOOKUP_TIMEOUT` | `20000` | Timeout in ms for service lookup during startup |
| `SERVICES_INIT_RETRY_SECONDS` | `5` | Seconds to wait before retrying a failed service init |
| `SERVICES_NUDGE_RETRY_SECONDS` | `2` | Seconds between service dependency resolution nudges |
| `TIMEZONE` | `Europe/Copenhagen` | Timezone for date formatting |
| `DATETIME_FORMAT` | `D-M-YYYY [kl.] k:mm` | Moment.js format string for displaying dates |
| `REQUEST_TIMEOUT_MS` | `15000` | Maximum time in ms before Express returns 504 Gateway Timeout |
| `WEB_CONCURRENCY` | `1` | Number of web worker processes |
| `CRONJOB_DEFAULT_FREQUENCY_MINUTES` | `5` | Default frequency in minutes for cron jobs |
| `CRON_POWERMETER_SUBSCRIPTIONS_DISABLED` | — | If set, disable powermeter subscription cron jobs |
| `NOTIFICATIONS_DISABLED` | — | If set, disable all email/Pushover notifications |
| `NOTIFICATIONS_EMAIL_OVERRIDE` | — | Send all notification emails to this address instead |
| `ALERTS_BINARY_SENSOR_DISABLE` | — | If set to trueish, disable binary sensor alert timeouts |
| `ALERTS_TIMEOUT_BINARY_SENSOR` | `600000` | Binary sensor timeout in milliseconds (10 min default) |
| `EVENT_LOG_TTL_SECS` | `604800` | Time-to-live in seconds for event log entries (7 days default) |
| `EVENT_LOG_MAX_ENTRIES` | `100` | Maximum number of event log entries to keep |
| `EVENT_LOG_PAGE_SIZE` | `20` | Number of event log entries per page |
| `HEALTHCHECKS_URL` | — | Healthchecks.io ping URL. If set, pings every minute based on `/health` status |
| `WATCHDOG_DISABLED_DEVICES` | — | Comma-separated device IDs to exclude from watchdog |
| `WATCHDOG_INTERVAL_DEVICES` | — | Interval for device watchdog checks |
| `WATCHDOG_INTERVAL_SENSORS` | — | Interval for sensor watchdog checks |
| `WHITELISTED_DEVICE_IDS` | — | Comma-separated device IDs allowed without full auth |
| `WHITELISTED_IMPERSONATION_ID` | — | User ID allowed for impersonation |

### OIDC Providers

Configure one or more OIDC providers to enable login. Only providers with all four variables set will appear on the login page. At least one provider must be configured.

#### Google

| Variable | Description |
|----------|-------------|
| `OIDC_CLIENT_ID_GOOGLE` | Google OAuth client ID |
| `OIDC_CLIENT_SECRET_GOOGLE` | Google OAuth client secret |
| `OIDC_PROVIDER_URL_GOOGLE` | Google OIDC discovery URL |
| `OIDC_REDIRECT_URI_GOOGLE` | Redirect URI registered with Google |

#### GitHub

| Variable | Description |
|----------|-------------|
| `OIDC_CLIENT_ID_GITHUB` | GitHub OAuth app client ID |
| `OIDC_CLIENT_SECRET_GITHUB` | GitHub OAuth app client secret |
| `OIDC_PROVIDER_URL_GITHUB` | GitHub OIDC provider URL |
| `OIDC_REDIRECT_URI_GITHUB` | Redirect URI registered with GitHub |

#### Microsoft

| Variable | Description |
|----------|-------------|
| `OIDC_CLIENT_ID_MICROSOFT` | Microsoft Entra ID client ID |
| `OIDC_CLIENT_SECRET_MICROSOFT` | Microsoft Entra ID client secret |
| `OIDC_PROVIDER_URL_MICROSOFT` | Microsoft OIDC discovery URL |
| `OIDC_REDIRECT_URI_MICROSOFT` | Redirect URI registered with Microsoft |

#### Local (for testing)

A built-in test OIDC provider for local development. Start it with `npm run oidc-provider`.

| Variable | Value |
|----------|-------|
| `OIDC_PROVIDER_URL_LOCAL` | `http://localhost:9876` |
| `OIDC_CLIENT_ID_LOCAL` | `test-client-id` |
| `OIDC_CLIENT_SECRET_LOCAL` | `test-client-secret` |
| `OIDC_REDIRECT_URI_LOCAL` | `http://localhost:8080/openid/callback/local` |

Set `OIDC_LOCAL_SUB` on the provider process to override the `sub` claim (used to match a user in `login_oidc_mapping`). This lets you log in as an existing user during local testing.

#### Testing login failures

Set `OIDC_FORCE_LOGIN_FAILURE` to any value to force the OIDC callback to fail after the provider redirects back. This renders the login-failed page so you can verify the error UI without needing an actual misconfiguration.

### Notification Templates

All notification template variables are optional and use Handlebars syntax. Available context: `{{app.name}}`, `{{sensor.id}}`, `{{sensor.name}}`, `{{device.id}}`, `{{device.name}}`, `{{data.*}}`, `{{url.target}}`, `{{url.app}}`.

| Variable | Description |
|----------|-------------|
| `TEMPL_TITLE_SENSOR_TIMEOUT` | Title for sensor timeout notifications |
| `TEMPL_MSG_SENSOR_TIMEOUT` | Message body for sensor timeout notifications |
| `TEMPL_TITLE_SENSOR_VALUE` | Title for sensor value notifications |
| `TEMPL_MSG_SENSOR_VALUE` | Message body for sensor value notifications |
| `TEMPL_TITLE_DEVICE_TIMEOUT` | Title for device timeout notifications |
| `TEMPL_MSG_DEVICE_TIMEOUT` | Message body for device timeout notifications |
| `TEMPL_TITLE_DEVICE_RESTART` | Title for device restart notifications |
| `TEMPL_MSG_DEVICE_RESTART` | Message body for device restart notifications |
| `TEMPL_TITLE_DEVICE_NOSENSORS` | Title for device-without-sensors notifications |
| `TEMPL_MSG_DEVICE_NOSENSORS` | Message body for device-without-sensors notifications |

## Test data

### Smart.me

clientId = smartme-client-1
username = cc8f022c-77b0-40de-8595-fb9c5ebb2e0b
password = 540f779b-6315-4e46-8ff6-4c57f4980609
sensorId = 94f7a0f4-d85b-4815-9c77-833be7c28779
