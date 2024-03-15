#!/bin/bash
VERSION=`cat package.json | jq ".version" -r`
IFS="." read -a VERSION_SPLIT <<< "$VERSION"
echo "Version, full: $VERSION"
echo "Version, major: ${VERSION_SPLIT[0]}"
echo "Version, minor: ${VERSION_SPLIT[1]}"
echo "Version, patch: ${VERSION_SPLIT[2]}"
docker push lekkim/sensorcentral:$VERSION
docker push lekkim/sensorcentral:${VERSION_SPLIT[0]}.${VERSION_SPLIT[1]}
docker push lekkim/sensorcentral:${VERSION_SPLIT[0]}
