#!/bin/bash
VERSION=`cat package.json| jq ".version" -r`
GITCOMMIT=`git rev-parse --short HEAD`
echo "Version: $VERSION"
echo "Commit: $GITCOMMIT"
docker build --build-arg APP_GITCOMMIT=$GITCOMMIT --tag lekkim/sensorcentral:$VERSION .
