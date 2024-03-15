#!/bin/sh
echo "APP_GITCOMMIT=$APP_GITCOMMIT" > ./.env
echo "APP_VERSION=$APP_VERSION" >> ./.env
echo "NODE_ENV=$APP_NODE_ENV" >> ./.env
