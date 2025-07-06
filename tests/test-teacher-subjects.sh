#!/bin/bash

echo "=== Teacher-Subject Assignments API Test ==="

# Base URL for deployed API
BASE_URL="https://school-timetable-backend.grundhunter.workers.dev/api"

echo "1. Getting existing schools..."
SCHOOLS_RESPONSE=$(curl -s ${BASE_URL}/schools)
echo "$SCHOOLS_RESPONSE"

# Extract school ID from response
SCHOOL_ID=$(echo "$SCHOOLS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Using School ID: $SCHOOL_ID"

echo -e "\n2. Getting existing teachers..."
TEACHERS_RESPONSE=$(curl -s "${BASE_URL}/teachers?schoolId=${SCHOOL_ID}")
echo "$TEACHERS_RESPONSE"

# Extract teacher ID from response
TEACHER_ID=$(echo "$TEACHERS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Using Teacher ID: $TEACHER_ID"

echo -e "\n3. Getting existing subjects..."
SUBJECTS_RESPONSE=$(curl -s "${BASE_URL}/subjects?schoolId=${SCHOOL_ID}")
echo "$SUBJECTS_RESPONSE"

# Extract subject IDs correctly
MATH_ID=$(echo "$SUBJECTS_RESPONSE" | grep -o '"id":"[^"]*","name":"数学I"' | cut -d'"' -f4)
ENGLISH_ID=$(echo "$SUBJECTS_RESPONSE" | grep -o '"id":"[^"]*","name":"英語"' | cut -d'"' -f4)
SCIENCE_ID=$(echo "$SUBJECTS_RESPONSE" | grep -o '"id":"[^"]*","name":"理科"' | cut -d'"' -f4)

# Fallback: get any subject IDs if specific ones not found
if [ -z "$MATH_ID" ]; then
    MATH_ID=$(echo "$SUBJECTS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi
if [ -z "$ENGLISH_ID" ]; then
    ENGLISH_ID=$(echo "$SUBJECTS_RESPONSE" | grep -o '"id":"[^"]*"' | head -2 | tail -1 | cut -d'"' -f4)
fi
if [ -z "$SCIENCE_ID" ]; then
    SCIENCE_ID=$(echo "$SUBJECTS_RESPONSE" | grep -o '"id":"[^"]*"' | head -3 | tail -1 | cut -d'"' -f4)
fi

echo "Math Subject ID: $MATH_ID"
echo "English Subject ID: $ENGLISH_ID"
echo "Science Subject ID: $SCIENCE_ID"

if [ ! -z "$TEACHER_ID" ] && [ ! -z "$MATH_ID" ]; then
    echo -e "\n4. Testing teacher's subjects (should be empty initially)..."
    curl -s "${BASE_URL}/assignments/teachers/${TEACHER_ID}/subjects"

    echo -e "\n5. Assigning Math to teacher..."
    curl -s -H "Content-Type: application/json" \
         -d "{\"subjectId\":\"${MATH_ID}\"}" \
         "${BASE_URL}/assignments/teachers/${TEACHER_ID}/subjects"

    echo -e "\n6. Assigning English to teacher..."
    if [ ! -z "$ENGLISH_ID" ]; then
        curl -s -H "Content-Type: application/json" \
             -d "{\"subjectId\":\"${ENGLISH_ID}\"}" \
             "${BASE_URL}/assignments/teachers/${TEACHER_ID}/subjects"
    fi

    echo -e "\n7. Getting teacher's subjects after assignments..."
    curl -s "${BASE_URL}/assignments/teachers/${TEACHER_ID}/subjects"

    echo -e "\n8. Testing duplicate assignment (should fail)..."
    curl -s -H "Content-Type: application/json" \
         -d "{\"subjectId\":\"${MATH_ID}\"}" \
         "${BASE_URL}/assignments/teachers/${TEACHER_ID}/subjects"

    echo -e "\n9. Getting subject's teachers..."
    curl -s "${BASE_URL}/assignments/subjects/${MATH_ID}/teachers"

    echo -e "\n10. Testing bulk assignment..."
    if [ ! -z "$SCIENCE_ID" ]; then
        BULK_SUBJECTS="[\"${SCIENCE_ID}\"]"
        if [ ! -z "$ENGLISH_ID" ]; then
            BULK_SUBJECTS="[\"${SCIENCE_ID}\",\"${ENGLISH_ID}\"]"
        fi
        curl -s -H "Content-Type: application/json" \
             -d "{\"subjectIds\":${BULK_SUBJECTS}}" \
             "${BASE_URL}/assignments/teachers/${TEACHER_ID}/subjects/bulk"
    fi

    echo -e "\n11. Getting school assignments..."
    curl -s "${BASE_URL}/assignments/schools/${SCHOOL_ID}/assignments"

    echo -e "\n12. Removing assignment..."
    curl -s -X DELETE "${BASE_URL}/assignments/teachers/${TEACHER_ID}/subjects/${ENGLISH_ID}"

    echo -e "\n13. Getting teacher's subjects after removal..."
    curl -s "${BASE_URL}/assignments/teachers/${TEACHER_ID}/subjects"

else
    echo "Teacher ID or Math Subject ID not found. Skipping assignment tests."
fi

echo -e "\nTeacher-Subject Assignments API test completed."