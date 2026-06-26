FROM node:24-alpine

EXPOSE 8080

# build args
ARG APP_NODE_ENV
ARG APP_GITCOMMIT
ARG APP_VERSION

ENV PORT=8080

# Create app directory
WORKDIR /usr/src/app

# Install dependencies (cached unless package files change)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npx tsc -p src/tsconfig.json && npm run build

# Write .env with build-time metadata
RUN echo "APP_GITCOMMIT=$APP_GITCOMMIT" > .env && \
    echo "APP_VERSION=$APP_VERSION" >> .env && \
    echo "NODE_ENV=$APP_NODE_ENV" >> .env

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

CMD [ "node", "server-dist/workers/worker_web.js" ]
