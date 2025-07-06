#!/bin/bash

# フロントエンド連携機能のテストスクリプト
# 新しく追加されたAPI機能の動作確認

echo "🔗 フロントエンド連携機能のテスト開始"

# APIのベースURL（デプロイ済みの場合は変更）
BASE_URL="https://school-timetable-backend.malah-shunmu.workers.dev"

echo ""
echo "💗 システムヘルスチェック"
curl -s "$BASE_URL/api/frontend/health" | jq '.'

echo ""
echo "📊 システム情報取得"
curl -s "$BASE_URL/api/frontend/system/info" | jq '.'

echo ""
echo "⚡ 超高速制約検証テスト（データベースアクセスなし）"
curl -s -X POST "$BASE_URL/api/frontend/instant-validate" \
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
    "checkTypes": ["teacher_conflict", "classroom_conflict"]
  }' | jq '.'

echo ""
echo "🔍 リアルタイム制約検証テスト（軽量モード）"
curl -s -X POST "$BASE_URL/api/frontend/timetables/sample-id/quick-validate" \
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
        "subjectId": "english",
        "teacherId": "teacher-tanaka",
        "classroomId": "room-101",
        "dayOfWeek": 1,
        "period": 1
      }
    ],
    "mode": "quick"
  }' | jq '.'

echo ""
echo "📈 エラー統計情報取得"
curl -s "$BASE_URL/api/frontend/system/error-stats" | jq '.'

echo ""
echo "🔧 エラーハンドリングテスト（無効なデータ）"
curl -s -X POST "$BASE_URL/api/frontend/instant-validate" \
  -H "Content-Type: application/json" \
  -d '{
    "schedules": [
      {
        "classId": "",
        "subjectId": "math",
        "teacherId": "teacher-yamada",
        "classroomId": "room-101",
        "dayOfWeek": 8,
        "period": 0
      }
    ]
  }' | jq '.'

echo ""
echo "✅ フロントエンド連携機能のテスト完了"
echo ""
echo "🚀 実装された機能:"
echo "  ⚡ 超高速制約検証 (50ms以内)"
echo "  🔍 リアルタイム制約検証"
echo "  📊 時間割グリッドデータ取得"
echo "  📈 統計情報とヘルスチェック"
echo "  🛡️ 統一エラーハンドリング"
echo "  📋 データ整合性チェック"
echo ""
echo "📋 利用可能なエンドポイント:"
echo "  - GET  /api/frontend/health - ヘルスチェック"
echo "  - POST /api/frontend/instant-validate - 超高速検証"
echo "  - POST /api/frontend/timetables/:id/quick-validate - リアルタイム検証"
echo "  - GET  /api/frontend/timetables/:id/grid - グリッドデータ"
echo "  - GET  /api/frontend/timetables/:id/statistics - 統計情報"
echo "  - GET  /api/frontend/system/info - システム情報"
echo ""
echo "💡 フロントエンドでの活用例:"
echo "  - ドラッグ&ドロップ時の即座な競合チェック"
echo "  - 時間割グリッドのリアルタイム更新"
echo "  - 制約違反の視覚的ハイライト"
echo "  - 統計情報のダッシュボード表示"