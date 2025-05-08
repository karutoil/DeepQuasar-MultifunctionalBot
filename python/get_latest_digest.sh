#!/bin/bash

# Fetch the latest digest for karutoil/deepquasar-multifunctionalbot:latest from Docker Hub
REPO="karutoil/deepquasar-multifunctionalbot"
TAG="latest"

API_URL="https://registry.hub.docker.com/v2/repositories/${REPO}/tags/${TAG}"

DIGEST=$(curl -s "$API_URL" | jq -r '.images[0].digest')

if [ -z "$DIGEST" ] || [ "$DIGEST" == "null" ]; then
  echo "Failed to fetch latest digest from Docker Hub."
  exit 1
fi

echo "export DOCKER_IMAGE_DIGEST=$DIGEST"
