#!/bin/bash

echo "=== Teachers API Test ==="

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

echo -e "\n2. Testing teachers list (empty)..."
TEACHERS_RESPONSE=$(wget --quiet --output-document=- ${BASE_URL}/teachers)
echo "$TEACHERS_RESPONSE"

echo -e "\n3. Testing teachers list with school filter..."
TEACHERS_FILTERED_RESPONSE=$(wget --quiet --output-document=- "${BASE_URL}/teachers?schoolId=${SCHOOL_ID}")
echo "$TEACHERS_FILTERED_RESPONSE"

echo -e "\n4. Creating a test teacher..."
CREATE_TEACHER_RESPONSE=$(wget --header="Content-Type: application/json" \
     --post-data="{\"name\":\"田中先生\",\"schoolId\":\"${SCHOOL_ID}\"}" \
     --quiet \
     --output-document=- \
     ${BASE_URL}/teachers 2>&1)
echo "$CREATE_TEACHER_RESPONSE"

# Extract teacher ID from response
TEACHER_ID=$(echo "$CREATE_TEACHER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created Teacher ID: $TEACHER_ID"

echo -e "\n5. Creating another test teacher..."
wget --header="Content-Type: application/json" \
     --post-data="{\"name\":\"佐藤先生\",\"schoolId\":\"${SCHOOL_ID}\"}" \
     --quiet \
     --output-document=- \
     ${BASE_URL}/teachers

echo -e "\n6. Getting teachers list again..."
wget --quiet --output-document=- ${BASE_URL}/teachers

echo -e "\n7. Getting teachers list with school filter..."
wget --quiet --output-document=- "${BASE_URL}/teachers?schoolId=${SCHOOL_ID}"

if [ ! -z "$TEACHER_ID" ]; then
    echo -e "\n8. Getting teacher details..."
    wget --quiet --output-document=- "${BASE_URL}/teachers/${TEACHER_ID}"
    
    echo -e "\n9. Updating teacher..."
    wget --header="Content-Type: application/json" \
         --method=PUT \
         --body-data='{"name":"田中太郎先生"}' \
         --quiet \
         --output-document=- \
         "${BASE_URL}/teachers/${TEACHER_ID}"
    
    echo -e "\n10. Getting updated teacher details..."
    wget --quiet --output-document=- "${BASE_URL}/teachers/${TEACHER_ID}"
fi

echo -e "\n11. Testing duplicate teacher creation..."
wget --header="Content-Type: application/json" \
     --post-data="{\"name\":\"田中太郎先生\",\"schoolId\":\"${SCHOOL_ID}\"}" \
     --quiet \
     --output-document=- \
     ${BASE_URL}/teachers

echo -e "\nTeachers API test completed."