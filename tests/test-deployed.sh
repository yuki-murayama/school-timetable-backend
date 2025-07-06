#!/bin/bash

echo "=== Deployed API Test ==="

# Base URL for deployed API
BASE_URL="https://school-timetable-backend.grundhunter.workers.dev/api"

echo "1. Testing deployed home page..."
wget --quiet --output-document=- https://school-timetable-backend.grundhunter.workers.dev/

echo -e "\n2. Testing health check..."
wget --quiet --output-document=- ${BASE_URL}/test/health

echo -e "\n3. Testing mock schools list..."
wget --quiet --output-document=- ${BASE_URL}/test/mock-schools

echo -e "\n4. Testing real schools API..."
wget --quiet --output-document=- ${BASE_URL}/schools

echo -e "\n5. Creating a test school..."
wget --header="Content-Type: application/json" \
     --post-data='{"name":"テスト中学校"}' \
     --quiet \
     --output-document=- \
     ${BASE_URL}/schools

echo -e "\n6. Getting schools list again..."
wget --quiet --output-document=- ${BASE_URL}/schools

echo -e "\nDeployed API test completed."