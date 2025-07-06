#!/bin/bash

echo "=== Timetables API Test ==="

# Base URL for deployed API
BASE_URL="https://school-timetable-backend.grundhunter.workers.dev/api"

echo "1. Getting existing schools..."
SCHOOLS_RESPONSE=$(curl -s ${BASE_URL}/schools)
SCHOOL_ID=$(echo "$SCHOOLS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Using School ID: $SCHOOL_ID"

echo -e "\n2. Getting existing classes..."
CLASSES_RESPONSE=$(curl -s "${BASE_URL}/classes?schoolId=${SCHOOL_ID}")
CLASS_ID=$(echo "$CLASSES_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Using Class ID: $CLASS_ID"

echo -e "\n3. Getting existing teachers..."
TEACHERS_RESPONSE=$(curl -s "${BASE_URL}/teachers?schoolId=${SCHOOL_ID}")
TEACHER_ID=$(echo "$TEACHERS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Using Teacher ID: $TEACHER_ID"

echo -e "\n4. Getting existing subjects..."
SUBJECTS_RESPONSE=$(curl -s "${BASE_URL}/subjects?schoolId=${SCHOOL_ID}")
SUBJECT_ID=$(echo "$SUBJECTS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Using Subject ID: $SUBJECT_ID"

echo -e "\n5. Getting existing classrooms..."
CLASSROOMS_RESPONSE=$(curl -s "${BASE_URL}/classrooms?schoolId=${SCHOOL_ID}")
CLASSROOM_ID=$(echo "$CLASSROOMS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Using Classroom ID: $CLASSROOM_ID"

if [ -z "$CLASSROOM_ID" ]; then
    echo "No classroom found, creating one..."
    CREATE_CLASSROOM_RESPONSE=$(curl -s -H "Content-Type: application/json" \
         -d "{\"name\":\"1-1教室\",\"type\":\"普通教室\",\"schoolId\":\"${SCHOOL_ID}\"}" \
         ${BASE_URL}/classrooms)
    echo "$CREATE_CLASSROOM_RESPONSE"
    CLASSROOM_ID=$(echo "$CREATE_CLASSROOM_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "Created Classroom ID: $CLASSROOM_ID"
fi

echo -e "\n6. Testing timetables list (should be empty initially)..."
curl -s "${BASE_URL}/timetables?schoolId=${SCHOOL_ID}"

echo -e "\n7. Creating a test timetable..."
CREATE_TIMETABLE_RESPONSE=$(curl -s -H "Content-Type: application/json" \
     -d "{\"name\":\"2024年度第1学期\",\"schoolId\":\"${SCHOOL_ID}\",\"saturdayHours\":4}" \
     ${BASE_URL}/timetables)
echo "$CREATE_TIMETABLE_RESPONSE"

TIMETABLE_ID=$(echo "$CREATE_TIMETABLE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created Timetable ID: $TIMETABLE_ID"

echo -e "\n8. Getting timetables list after creation..."
curl -s "${BASE_URL}/timetables?schoolId=${SCHOOL_ID}"

if [ ! -z "$TIMETABLE_ID" ]; then
    echo -e "\n9. Getting timetable details..."
    curl -s "${BASE_URL}/timetables/${TIMETABLE_ID}"

    echo -e "\n10. Getting timetable details with slots..."
    curl -s "${BASE_URL}/timetables/${TIMETABLE_ID}?includeSlots=true"

    if [ ! -z "$CLASS_ID" ] && [ ! -z "$SUBJECT_ID" ] && [ ! -z "$TEACHER_ID" ] && [ ! -z "$CLASSROOM_ID" ]; then
        echo -e "\n11. Setting timetable slots..."
        SLOTS_DATA='{"slots":[
            {"classId":"'${CLASS_ID}'","subjectId":"'${SUBJECT_ID}'","teacherId":"'${TEACHER_ID}'","classroomId":"'${CLASSROOM_ID}'","dayOfWeek":1,"period":1},
            {"classId":"'${CLASS_ID}'","subjectId":"'${SUBJECT_ID}'","teacherId":"'${TEACHER_ID}'","classroomId":"'${CLASSROOM_ID}'","dayOfWeek":1,"period":2},
            {"classId":"'${CLASS_ID}'","subjectId":"'${SUBJECT_ID}'","teacherId":"'${TEACHER_ID}'","classroomId":"'${CLASSROOM_ID}'","dayOfWeek":2,"period":1}
        ]}'
        curl -s -H "Content-Type: application/json" \
             -d "$SLOTS_DATA" \
             "${BASE_URL}/timetables/${TIMETABLE_ID}/slots"

        echo -e "\n12. Getting class timetable..."
        curl -s "${BASE_URL}/timetables/${TIMETABLE_ID}/slots/${CLASS_ID}"

        echo -e "\n13. Getting teacher timetable..."
        curl -s "${BASE_URL}/timetables/${TIMETABLE_ID}/teachers/${TEACHER_ID}"

        echo -e "\n14. Getting timetable with slots again..."
        curl -s "${BASE_URL}/timetables/${TIMETABLE_ID}?includeSlots=true"
    fi

    echo -e "\n15. Updating timetable..."
    curl -s -X PUT -H "Content-Type: application/json" \
         -d '{"name":"2024年度第1学期（更新版）"}' \
         "${BASE_URL}/timetables/${TIMETABLE_ID}"

    echo -e "\n16. Creating another timetable (should become active)..."
    curl -s -H "Content-Type: application/json" \
         -d "{\"name\":\"2024年度第2学期\",\"schoolId\":\"${SCHOOL_ID}\",\"saturdayHours\":4}" \
         ${BASE_URL}/timetables

    echo -e "\n17. Getting active timetables..."
    curl -s "${BASE_URL}/timetables?schoolId=${SCHOOL_ID}&isActive=true"

    echo -e "\n18. Testing duplicate timetable creation..."
    curl -s -H "Content-Type: application/json" \
         -d "{\"name\":\"2024年度第2学期\",\"schoolId\":\"${SCHOOL_ID}\"}" \
         ${BASE_URL}/timetables
fi

echo -e "\nTimetables API test completed."