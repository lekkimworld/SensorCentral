FROM node:21-alpine

EXPOSE 8080
ARG NODE_ENV
ARG LOG_LEVEL
ARG LOG_LEVEL_LOGGERS
ARG DATABASE_URL
ARG DATABASE_ALLOW_SCHEMA_UPGRADE
ARG DATABASE_SSL
ARG REDIS_URL
ARG REDIS_TLS_URL
ARG REDIS_CONNECTION_TIMEOUT
ARG CLOUDAMQP_URL
ARG APP_NO_PROD_TLS
ARG APP_PROTOCOL
ARG APP_DOMAIN
ARG APP_GITCOMMIT=na
ARG APP_TITLE
ARG OIDC_PROVIDER_URL_GOOGLE
ARG OIDC_CLIENT_ID_GOOGLE
ARG OIDC_CLIENT_SECRET_GOOGLE
ARG OIDC_REDIRECT_URI_GOOGLE
ARG OIDC_PROVIDER_URL_GITHUB
ARG OIDC_CLIENT_ID_GITHUB
ARG OIDC_CLIENT_SECRET_GITHUB
ARG OIDC_REDIRECT_URI_GITHUB
ARG OIDC_PROVIDER_URL_MICROSOFT
ARG OIDC_CLIENT_ID_MICROSOFT
ARG OIDC_CLIENT_SECRET_MICROSOFT
ARG OIDC_REDIRECT_URI_MICROSOFT
ARG GOOGLE_SERVICE_ACCOUNT_EMAIL
ARG GOOGLE_TOKEN_URI
ARG GOOGLE_PRIVATE_KEY
ARG API_JWT_SECRET
ARG SESSION_SECRET
ARG SMARTME_KEY
ARG SMARTME_PROTOCOL
ARG SMARTME_DOMAIN
ARG CRON_POWERMETER_SUBSCRIPTIONS_DISABLED
ARG NOTIFICATIONS_DISABLED
ARG ALERTS_TIMEOUT_BINARY_SENSOR

ENV PORT=8080
ENV NODE_ENV="${NODE_ENV}"
ENV LOG_LEVEL="${LOG_LEVEL}"
ENV LOG_LEVEL_LOGGERS="${LOG_LEVEL_LOGGERS}"
ENV DATABASE_URL="${DATABASE_URL}"
ENV DATABASE_ALLOW_SCHEMA_UPGRADE="${DATABASE_ALLOW_SCHEMA_UPGRADE}"
ENV DATABASE_SSL="${DATABASE_SSL}"
ENV REDIS_URL="${REDIS_URL}"
ENV REDIS_TLS_URL="${REDIS_TLS_URL}"
ENV REDIS_CONNECTION_TIMEOUT="${REDIS_CONNECTION_TIMEOUT}"
ENV CLOUDAMQP_URL="${CLOUDAMQP_URL}"
ENV APP_NO_PROD_TLS="${APP_NO_PROD_TLS}"
ENV APP_PROTOCOL="${APP_PROTOCOL}"
ENV APP_DOMAIN="${APP_DOMAIN}"
ENV APP_GITCOMMIT="${APP_GITCOMMIT}"
ENV APP_TITLE="${APP_TITLE}"
ENV OIDC_PROVIDER_URL_GOOGLE="${OIDC_PROVIDER_URL_GOOGLE}}"
ENV OIDC_CLIENT_ID_GOOGLE="${OIDC_CLIENT_ID_GOOGLE}}"
ENV OIDC_CLIENT_SECRET_GOOGLE="${OIDC_CLIENT_SECRET_GOOGLE}}"
ENV OIDC_REDIRECT_URI_GOOGLE="${OIDC_REDIRECT_URI_GOOGLE}}"
ENV OIDC_PROVIDER_URL_GITHUB="${OIDC_PROVIDER_URL_GITHUB}}"
ENV OIDC_CLIENT_ID_GITHUB="${OIDC_CLIENT_ID_GITHUB}}"
ENV OIDC_CLIENT_SECRET_GITHUB="${OIDC_CLIENT_SECRET_GITHUB}}"
ENV OIDC_REDIRECT_URI_GITHUB="${OIDC_REDIRECT_URI_GITHUB}}"
ENV OIDC_PROVIDER_URL_MICROSOFT="${OIDC_PROVIDER_URL_MICROSOFT}}"
ENV OIDC_CLIENT_ID_MICROSOFT="${OIDC_CLIENT_ID_MICROSOFT}}"
ENV OIDC_CLIENT_SECRET_MICROSOFT="${OIDC_CLIENT_SECRET_MICROSOFT}}"
ENV OIDC_REDIRECT_URI_MICROSOFT="${OIDC_REDIRECT_URI_MICROSOFT}}"
ENV GOOGLE_SERVICE_ACCOUNT_EMAIL="${GOOGLE_SERVICE_ACCOUNT_EMAIL}"
ENV GOOGLE_TOKEN_URI="${GOOGLE_TOKEN_URI}"
ENV GOOGLE_PRIVATE_KEY="${GOOGLE_PRIVATE_KEY}"
ENV API_JWT_SECRET="${API_JWT_SECRET}"
ENV SESSION_SECRET="${SESSION_SECRET}"
ENV SMARTME_KEY="${SMARTME_KEY}"
ENV SMARTME_PROTOCOL="${SMARTME_PROTOCOL}"
ENV SMARTME_DOMAIN="${SMARTME_DOMAIN}"
ENV CRON_POWERMETER_SUBSCRIPTIONS_DISABLED="${CRON_POWERMETER_SUBSCRIPTIONS_DISABLED}"
ENV NOTIFICATIONS_DISABLED="${NOTIFICATIONS_DISABLED}"
ENV ALERTS_TIMEOUT_BINARY_SENSOR="${ALERTS_TIMEOUT_BINARY_SENSOR}"

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .
COPY scripts/write_dotenv.sh ./
RUN /usr/src/app/write_dotenv.sh ${APP_GITCOMMIT}
RUN npm run build

CMD [ "npm", "run", "web-serve" ]
