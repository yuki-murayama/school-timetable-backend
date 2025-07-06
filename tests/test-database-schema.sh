#!/bin/bash

# データベーススキーマ完全化のテストスクリプト
# 新しく追加された管理機能の動作確認

echo "🗄️ データベーススキーマ完全化のテスト開始"

# APIのベースURL（デプロイ済みの場合は変更）
BASE_URL="https://school-timetable-backend.malah-shunmu.workers.dev"

echo ""
echo "📊 データベース統計情報取得テスト"
curl -s "$BASE_URL/api/database/statistics" | jq '.'

echo ""
echo "🔍 データベースヘルスチェック"
curl -s "$BASE_URL/api/database/health" | jq '.'

echo ""
echo "⚡ パフォーマンス分析テスト"
curl -s "$BASE_URL/api/database/performance" | jq '.'

echo ""
echo "🧹 データベースクリーンアップ（ドライラン）"
curl -s -X POST "$BASE_URL/api/database/cleanup" \
  -H "Content-Type: application/json" \
  -d '{
    "olderThanDays": 90,
    "dryRun": true
  }' | jq '.'

echo ""
echo "⚙️ システム設定テスト"
echo "システム設定を設定..."
curl -s -X PUT "$BASE_URL/api/database/system/settings/test_key" \
  -H "Content-Type: application/json" \
  -d '{
    "value": {"enabled": true, "maxRetries": 3},
    "description": "テスト用設定",
    "category": "testing",
    "isPublic": false,
    "updatedBy": "test-user"
  }' | jq '.'

echo ""
echo "システム設定を取得..."
curl -s "$BASE_URL/api/database/system/settings/test_key" | jq '.'

echo ""
echo "🏫 学校データ整合性チェック（サンプル）"
curl -s "$BASE_URL/api/database/schools/sample-school-id/integrity" | jq '.'

echo ""
echo "📸 時間割スナップショット作成テスト"
curl -s -X POST "$BASE_URL/api/database/timetables/sample-timetable-id/snapshot" \
  -H "Content-Type: application/json" \
  -d '{
    "changeType": "updated",
    "changeDescription": "テスト用スナップショット作成",
    "changedBy": "test-user"
  }' | jq '.'

echo ""
echo "🔧 制約設定管理テスト"
curl -s -X PUT "$BASE_URL/api/database/schools/sample-school-id/constraints/teacher_conflict" \
  -H "Content-Type: application/json" \
  -d '{
    "isEnabled": true,
    "priority": 8,
    "parameters": {
      "strictMode": false,
      "allowPartTime": true
    },
    "updatedBy": "test-user"
  }' | jq '.'

echo ""
echo "👥 ユーザーアクセス権限管理テスト"
curl -s -X POST "$BASE_URL/api/database/schools/sample-school-id/access" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "role": "editor"
  }' | jq '.'

echo ""
echo "✅ データベーススキーマ完全化のテスト完了"
echo ""
echo "🗄️ 実装された新機能:"
echo "  📊 データベース統計・分析機能"
echo "  🔍 データ整合性チェック"
echo "  📸 時間割履歴・スナップショット管理"
echo "  ⚙️ システム設定管理"
echo "  👥 ユーザー・アクセス権限管理"
echo "  🧹 自動データクリーンアップ"
echo "  📋 生成ログ記録"
echo "  ⚡ パフォーマンス監視"
echo ""
echo "🗃️ 新しく追加されたテーブル:"
echo "  - users: ユーザー管理"
echo "  - user_schools: ユーザー・学校関係"
echo "  - timetable_history: 時間割履歴"
echo "  - constraint_configurations: 制約設定"
echo "  - generation_logs: 生成ログ"
echo "  - system_settings: システム設定"
echo ""
echo "📈 拡張された既存テーブル:"
echo "  - schools: 学校種別、設定、連絡先情報"
echo "  - classes: 担任、生徒数、セクション"
echo "  - teachers: 雇用形態、専門分野、ユーザー関連付け"
echo "  - subjects: 教科コード、カテゴリ、UI設定"
echo "  - classrooms: 建物、階、設備情報"
echo "  - timetables: 学年度、期間、承認機能"
echo "  - schedules: 隔週対応、代替授業、生成方式"
echo ""
echo "🚀 これで実運用に必要な全機能が揃いました！"