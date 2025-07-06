#!/bin/bash

echo "=== School Timetable API Test ==="

# Base URL
BASE_URL="http://localhost:5173/api"

echo "1. Testing home page..."
wget -qO- http://localhost:5173/ || echo "Failed to fetch home page"

echo -e "\n2. Creating a school..."
wget --header="Content-Type: application/json" \
     --post-data='{"name":"テスト中学校"}' \
     --quiet \
     --output-document=- \
     ${BASE_URL}/schools || echo "Failed to create school"

echo -e "\n3. Getting schools list..."
wget --quiet --output-document=- ${BASE_URL}/schools || echo "Failed to get schools"

echo -e "\n4. Creating a class..."
# First get the school ID from the schools list
SCHOOL_ID=$(wget --quiet --output-document=- ${BASE_URL}/schools | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ ! -z "$SCHOOL_ID" ]; then
    wget --header="Content-Type: application/json" \
         --post-data="{\"name\":\"1年A組\",\"grade\":1,\"schoolId\":\"${SCHOOL_ID}\"}" \
         --quiet \
         --output-document=- \
         ${BASE_URL}/classes || echo "Failed to create class"
else
    echo "No school ID found, skipping class creation"
fi

echo -e "\n5. Getting classes list..."
wget --quiet --output-document=- ${BASE_URL}/classes || echo "Failed to get classes"

echo -e "\nAPI test completed."