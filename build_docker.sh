#!/bin/bash
NODE_ENV=$1
if [ "$NODE_ENV" != "development" ] && [ "$NODE_ENV" != "production" ]; then
    echo "Usage: build_docker.sh <development|production> [platform(s)]"
    echo "  platform(s): linux/arm64, linux/amd64, or linux/arm64,linux/amd64 (default: both)"
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

PLATFORMS="${2:-linux/arm64,linux/amd64}"
TAGS="--tag lekkim/sensorcentral:$VERSION"
if [ "$NODE_ENV" == "production" ]; then
    TAGS="$TAGS --tag lekkim/sensorcentral:${VERSION_SPLIT[0]}.${VERSION_SPLIT[1]}"
    TAGS="$TAGS --tag lekkim/sensorcentral:${VERSION_SPLIT[0]}"
    TAGS="$TAGS --tag lekkim/sensorcentral:latest"
fi

# build and push multi-platform image
docker buildx build \
    --platform $PLATFORMS \
    --build-arg APP_GITCOMMIT=$GITCOMMIT \
    --build-arg APP_VERSION="$VERSION" \
    --build-arg APP_NODE_ENV="$NODE_ENV" \
    $TAGS \
    --push \
    .
echo "Built and pushed multi-platform image ($PLATFORMS) as ${VERSION}"
