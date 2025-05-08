#!/bin/bash

# This script fetches the latest digest of the Docker image
# Usage: ./get_latest_digest.sh [repository] [tag]

REPO=${1:-"deepquasar-multifunctionalbot"}
TAG=${2:-"nodejs"}

# Get the digest from Docker Hub
DIGEST=$(curl -s "https://registry.hub.docker.com/v2/repositories/${REPO}/tags/${TAG}" | grep -o '"digest":"[^"]*' | sed 's/"digest":"//')

if [ -z "$DIGEST" ]; then
    echo "Failed to get digest for ${REPO}:${TAG}"
    exit 1
fi

echo "$DIGEST"