#!/bin/bash

echo "=== Simple API Test ==="

# Test server on port 5173 (vite dev server)
BASE_URL="http://localhost:5173/api"

echo "1. Testing health check..."
wget --quiet --output-document=- ${BASE_URL}/test/health

echo -e "\n2. Testing mock schools list..."
wget --quiet --output-document=- ${BASE_URL}/test/mock-schools

echo -e "\n3. Creating a mock school..."
wget --header="Content-Type: application/json" \
     --post-data='{"name":"新しい学校"}' \
     --quiet \
     --output-document=- \
     ${BASE_URL}/test/mock-schools

echo -e "\n4. Testing mock schools list again..."
wget --quiet --output-document=- ${BASE_URL}/test/mock-schools

echo -e "\nTest completed."