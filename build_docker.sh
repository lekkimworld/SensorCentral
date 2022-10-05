#!/bin/bash
VERSION=`cat package.json| jq ".version" -r`
docker build --tag lekkim/sensorcentral:$VERSION .
