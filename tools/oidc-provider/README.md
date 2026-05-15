# Local OIDC Provider

Stub OIDC provider for local development and testing. Automatically logs in a test user without requiring an external identity provider.

## Usage

```bash
npm run oidc-provider
```

## Environment Variables

Configure via `tools/oidc-provider/.env`:

| Variable | Default | Description |
|---|---|---|
| `OIDC_PORT` | `9876` | Port the provider listens on |
| `OIDC_HOSTNAME` | `localhost` | Hostname used for issuer, token, userinfo, and JWKS endpoints (server-to-server) |
| `OIDC_EXTERNAL_HOSTNAME` | `localhost` | Hostname used for the authorization endpoint (browser-facing) |
| `OIDC_CLIENT_ID` | `test-client-id` | Client ID the provider accepts |
| `OIDC_CLIENT_SECRET` | `test-client-secret` | Client secret the provider accepts |
| `OIDC_SUB` | `local-test-user-001` | `sub` claim in tokens. Must match a row in `login_oidc_mapping` with `provider='local'` |

## Docker Setup

When the SensorCentral app runs in Docker but the provider runs on the host, the app needs `host.docker.internal` to reach the provider, while the browser still uses `localhost`.

In `tools/oidc-provider/.env`:

```env
OIDC_HOSTNAME=host.docker.internal
```

In the SensorCentral app environment:

```env
OIDC_PROVIDER_URL_LOCAL=http://host.docker.internal:9876
OIDC_CLIENT_ID_LOCAL=test-client-id
OIDC_CLIENT_SECRET_LOCAL=test-client-secret
OIDC_REDIRECT_URI_LOCAL=http://localhost:8080/openid/callback/local
```
