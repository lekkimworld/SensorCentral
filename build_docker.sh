#!/bin/bash
NODE_ENV=$1
if [ "$NODE_ENV" != "development" ] && [ "$NODE_ENV" != "production" ]; then
    echo "Parameter must be 'development' OR 'production'"
    exit 1
fi 

VERSION=`cat package.json | jq ".version" -r`
if [ "$NODE_ENV" == "development" ]; then
    VERSION=$VERSION-dev
fi
GITCOMMIT=`git rev-parse --short HEAD`
IFS="." read -a VERSION_SPLIT <<< "$VERSION"
echo "NODE_ENV: $NODE_ENV"
echo "Version, full: $VERSION"
echo "Version, major: ${VERSION_SPLIT[0]}"
echo "Version, minor: ${VERSION_SPLIT[1]}"
echo "Version, patch: ${VERSION_SPLIT[2]}"
echo "Commit: $GITCOMMIT"

# build
docker build \
    --build-arg APP_GITCOMMIT=$GITCOMMIT \
    --build-arg APP_VERSION="$VERSION" \
    --build-arg APP_NODE_ENV="$NODE_ENV" \
    --tag lekkim/sensorcentral:$VERSION \
    .
echo "Built image and tagged as ${VERSION}"

if [ "$NODE_ENV" == "production" ]; then
    # add additional tags
    echo "Tagging as ${VERSION_SPLIT[0]}.${VERSION_SPLIT[1]}"
    docker image tag lekkim/sensorcentral:$VERSION lekkim/sensorcentral:${VERSION_SPLIT[0]}.${VERSION_SPLIT[1]}
    echo "Tagging as ${VERSION_SPLIT[0]}"
    docker image tag lekkim/sensorcentral:$VERSION lekkim/sensorcentral:${VERSION_SPLIT[0]}
fi
