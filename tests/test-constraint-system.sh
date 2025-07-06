#!/bin/bash

# 制約条件システムのテストスクリプト
# 拡張可能な制約条件システムの機能をテスト

echo "🔍 制約条件システムのテスト開始"

# APIのベースURL（デプロイ済みの場合は変更）
BASE_URL="https://school-timetable-backend.malah-shunmu.workers.dev"

echo ""
echo "📋 利用可能な制約条件一覧を取得"
curl -s "$BASE_URL/api/constraints" | jq '.'

echo ""
echo "📝 特定制約条件の詳細を取得（教師時間重複制約）"
curl -s "$BASE_URL/api/constraints/teacher_conflict" | jq '.'

echo ""
echo "⚙️ 制約条件設定の更新テスト"
curl -s -X PATCH "$BASE_URL/api/constraints/teacher_conflict" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "parameters": {
      "strictMode": false,
      "allowPartTime": true
    }
  }' | jq '.'

echo ""
echo "🔧 制約条件検証テスト（サンプルデータ）"
curl -s -X POST "$BASE_URL/api/constraints/validate/sample-timetable-id" \
  -H "Content-Type: application/json" \
  -d '{
    "schedules": [
      {
        "classId": "class-1a",
        "subjectId": "math",
        "teacherId": "teacher-yamada",
        "classroomId": "room-101",
        "dayOfWeek": 1,
        "period": 1
      },
      {
        "classId": "class-1b", 
        "subjectId": "science",
        "teacherId": "teacher-yamada",
        "classroomId": "room-102",
        "dayOfWeek": 1,
        "period": 1
      }
    ],
    "schoolId": "sample-school",
    "saturdayHours": 0,
    "enabledConstraints": ["teacher_conflict", "classroom_conflict"]
  }' | jq '.'

echo ""
echo "📊 カテゴリ別制約検証テスト（教師制約のみ）"
curl -s -X POST "$BASE_URL/api/constraints/validate/sample-timetable-id/category/teacher" \
  -H "Content-Type: application/json" \
  -d '{
    "schedules": [
      {
        "classId": "class-1a",
        "subjectId": "math",
        "teacherId": "teacher-yamada",
        "classroomId": "room-101",
        "dayOfWeek": 1,
        "period": 1
      },
      {
        "classId": "class-1b",
        "subjectId": "science", 
        "teacherId": "teacher-yamada",
        "classroomId": "room-102",
        "dayOfWeek": 1,
        "period": 1
      }
    ],
    "schoolId": "sample-school",
    "saturdayHours": 0
  }' | jq '.'

echo ""
echo "✅ 制約条件システムのテスト完了"
echo ""
echo "📋 実装された制約条件:"
echo "  - teacher_conflict: 教師時間重複禁止"
echo "  - classroom_conflict: 教室時間重複禁止"
echo "  - subject_distribution: 教科配置バランス"
echo "  - time_slot_preference: 時間帯配置優先"
echo ""
echo "🔧 利用可能な機能:"
echo "  - 制約条件の有効/無効切り替え"
echo "  - 制約パラメータの動的変更"
echo "  - カテゴリ別制約検証"
echo "  - プラガブルな制約バリデーター追加"
echo "  - パフォーマンス測定"
echo ""
echo "🚀 システムは拡張可能で、新しい制約条件を簡単に追加できます！"