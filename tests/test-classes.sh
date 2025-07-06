#!/bin/bash

echo "=== Classes API Test ==="

# Base URL for deployed API
BASE_URL="https://school-timetable-backend.grundhunter.workers.dev/api"

echo "1. Getting existing schools..."
SCHOOLS_RESPONSE=$(wget --quiet --output-document=- ${BASE_URL}/schools)
echo "$SCHOOLS_RESPONSE"

# Extract school ID from response
SCHOOL_ID=$(echo "$SCHOOLS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Using School ID: $SCHOOL_ID"

if [ -z "$SCHOOL_ID" ]; then
    echo "No school found, creating one first..."
    CREATE_SCHOOL_RESPONSE=$(wget --header="Content-Type: application/json" \
         --post-data='{"name":"テスト中学校"}' \
         --quiet \
         --output-document=- \
         ${BASE_URL}/schools)
    echo "$CREATE_SCHOOL_RESPONSE"
    SCHOOL_ID=$(echo "$CREATE_SCHOOL_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "Created School ID: $SCHOOL_ID"
fi

echo -e "\n2. Testing classes list (empty)..."
wget --quiet --output-document=- ${BASE_URL}/classes

echo -e "\n3. Testing classes list with school filter..."
wget --quiet --output-document=- "${BASE_URL}/classes?schoolId=${SCHOOL_ID}"

echo -e "\n4. Creating a test class..."
wget --header="Content-Type: application/json" \
     --post-data="{\"name\":\"1年A組\",\"grade\":1,\"schoolId\":\"${SCHOOL_ID}\"}" \
     --quiet \
     --output-document=- \
     ${BASE_URL}/classes

echo -e "\n5. Creating another test class..."
wget --header="Content-Type: application/json" \
     --post-data="{\"name\":\"2年B組\",\"grade\":2,\"schoolId\":\"${SCHOOL_ID}\"}" \
     --quiet \
     --output-document=- \
     ${BASE_URL}/classes

echo -e "\n6. Getting classes list again..."
wget --quiet --output-document=- ${BASE_URL}/classes

echo -e "\n7. Getting classes list with school filter..."
wget --quiet --output-document=- "${BASE_URL}/classes?schoolId=${SCHOOL_ID}"

echo -e "\nClasses API test completed."