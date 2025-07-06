#!/bin/bash

echo "=== Subjects API Test ==="

# Base URL for deployed API
BASE_URL="https://school-timetable-backend.grundhunter.workers.dev/api"

echo "1. Getting existing schools..."
SCHOOLS_RESPONSE=$(curl -s ${BASE_URL}/schools)
echo "$SCHOOLS_RESPONSE"

# Extract school ID from response
SCHOOL_ID=$(echo "$SCHOOLS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Using School ID: $SCHOOL_ID"

if [ -z "$SCHOOL_ID" ]; then
    echo "No school found, creating one first..."
    CREATE_SCHOOL_RESPONSE=$(curl -s -H "Content-Type: application/json" \
         -d '{"name":"テスト中学校"}' \
         ${BASE_URL}/schools)
    echo "$CREATE_SCHOOL_RESPONSE"
    SCHOOL_ID=$(echo "$CREATE_SCHOOL_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "Created School ID: $SCHOOL_ID"
fi

echo -e "\n2. Testing subjects list (empty)..."
SUBJECTS_RESPONSE=$(curl -s ${BASE_URL}/subjects)
echo "$SUBJECTS_RESPONSE"

echo -e "\n3. Testing subjects list with school filter..."
SUBJECTS_FILTERED_RESPONSE=$(curl -s "${BASE_URL}/subjects?schoolId=${SCHOOL_ID}")
echo "$SUBJECTS_FILTERED_RESPONSE"

echo -e "\n4. Creating test subjects..."
echo "Creating 数学..."
CREATE_MATH_RESPONSE=$(curl -s -H "Content-Type: application/json" \
     -d "{\"name\":\"数学\",\"schoolId\":\"${SCHOOL_ID}\"}" \
     ${BASE_URL}/subjects)
echo "$CREATE_MATH_RESPONSE"

MATH_ID=$(echo "$CREATE_MATH_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created Math Subject ID: $MATH_ID"

echo -e "\nCreating 英語..."
curl -s -H "Content-Type: application/json" \
     -d "{\"name\":\"英語\",\"schoolId\":\"${SCHOOL_ID}\"}" \
     ${BASE_URL}/subjects

echo -e "\nCreating 理科..."
curl -s -H "Content-Type: application/json" \
     -d "{\"name\":\"理科\",\"schoolId\":\"${SCHOOL_ID}\"}" \
     ${BASE_URL}/subjects

echo -e "\nCreating 国語..."
curl -s -H "Content-Type: application/json" \
     -d "{\"name\":\"国語\",\"schoolId\":\"${SCHOOL_ID}\"}" \
     ${BASE_URL}/subjects

echo -e "\nCreating 社会..."
curl -s -H "Content-Type: application/json" \
     -d "{\"name\":\"社会\",\"schoolId\":\"${SCHOOL_ID}\"}" \
     ${BASE_URL}/subjects

echo -e "\n5. Getting subjects list again..."
curl -s ${BASE_URL}/subjects

echo -e "\n6. Getting subjects list with school filter..."
curl -s "${BASE_URL}/subjects?schoolId=${SCHOOL_ID}"

if [ ! -z "$MATH_ID" ]; then
    echo -e "\n7. Getting subject details..."
    curl -s "${BASE_URL}/subjects/${MATH_ID}"
    
    echo -e "\n8. Updating subject..."
    curl -s -X PUT -H "Content-Type: application/json" \
         -d '{"name":"数学I"}' \
         "${BASE_URL}/subjects/${MATH_ID}"
    
    echo -e "\n9. Getting updated subject details..."
    curl -s "${BASE_URL}/subjects/${MATH_ID}"
fi

echo -e "\n10. Testing duplicate subject creation..."
curl -s -H "Content-Type: application/json" \
     -d "{\"name\":\"数学I\",\"schoolId\":\"${SCHOOL_ID}\"}" \
     ${BASE_URL}/subjects

echo -e "\nSubjects API test completed."