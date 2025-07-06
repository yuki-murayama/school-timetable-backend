#!/bin/bash

# 認証機能の簡単なテスト
# 実際のAuth0設定での動作確認

echo "🔐 Auth0認証の基本テスト"

# 設定したドメインとAPIの値を使用
BASE_URL="http://localhost:5173"

# まず認証設定状態を確認
echo ""
echo "📋 Auth0設定状態確認:"
curl -s -X GET "$BASE_URL/api/auth/status" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "🏥 認証ヘルスチェック:"
curl -s -X GET "$BASE_URL/api/auth/health" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "⚙️ Auth0設定情報取得:"
curl -s -X GET "$BASE_URL/api/auth/config" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "🎭 開発環境用モックトークン生成:"
MOCK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/mock/token" \
  -H "Content-Type: application/json")
echo "$MOCK_RESPONSE" | jq '.'

echo ""
echo "👤 モックトークンでユーザー情報取得:"
curl -s -X GET "$BASE_URL/api/auth/user/me" \
  -H "Authorization: Bearer mock" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "🔑 ユーザー権限一覧取得:"
curl -s -X GET "$BASE_URL/api/auth/user/permissions" \
  -H "Authorization: Bearer mock" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "✅ トークン検証テスト:"
curl -s -X POST "$BASE_URL/api/auth/verify" \
  -H "Authorization: Bearer mock" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "🎯 カスタムモックユーザー生成:"
curl -s -X POST "$BASE_URL/api/auth/mock/user" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-admin@example.com",
    "name": "テスト管理者", 
    "role": "school_admin",
    "schoolId": "school-1"
  }' | jq '.'

echo ""
echo "📈 認証エラーハンドリングテスト:"
echo "無効なトークンでアクセス:"
curl -s -X GET "$BASE_URL/api/auth/user/me" \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "認証なしでアクセス:"
curl -s -X GET "$BASE_URL/api/auth/user/me" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "✅ 基本認証テスト完了"
echo ""
echo "🔧 次のステップ:"
echo "  1. Auth0の実際の値を wrangler.jsonc に設定済み ✅"
echo "  2. フロントエンドでAuth0ログインを実装"
echo "  3. 実際のJWTトークンでAPIテスト"