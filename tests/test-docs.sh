#!/bin/bash

# APIドキュメント機能のテストスクリプト
# Swagger UI と OpenAPI 仕様書の動作確認

echo "📖 APIドキュメント機能のテスト開始"

# APIのベースURL（デプロイ済みの場合は変更）
BASE_URL="https://school-timetable-backend.malah-shunmu.workers.dev"

echo ""
echo "🏠 ドキュメントホーム画面の確認"
echo "ブラウザで以下のURLにアクセスしてください:"
echo "$BASE_URL/docs"

echo ""
echo "📊 Swagger UI の確認"
echo "ブラウザで以下のURLにアクセスしてください:"
echo "$BASE_URL/docs/ui"

echo ""
echo "📄 OpenAPI仕様書 JSON の取得テスト"
curl -s "$BASE_URL/docs/doc" | jq '.info'

echo ""
echo "🔧 APIエンドポイントの確認"
echo "OpenAPI仕様書から利用可能なエンドポイント一覧:"
curl -s "$BASE_URL/docs/doc" | jq -r '.paths | keys[]' | head -10

echo ""
echo "📋 利用可能なタグ（カテゴリ）:"
curl -s "$BASE_URL/docs/doc" | jq -r '.tags[].name'

echo ""
echo "✅ ドキュメント機能のテスト完了"
echo ""
echo "📖 利用可能なドキュメント:"
echo "  - $BASE_URL/docs - ドキュメントホーム"
echo "  - $BASE_URL/docs/ui - Swagger UI（インタラクティブ）"
echo "  - $BASE_URL/docs/doc - OpenAPI 3.0 仕様書（JSON）"
echo ""
echo "🔧 主要機能:"
echo "  - インタラクティブなAPI試行"
echo "  - リクエスト/レスポンスの詳細表示"
echo "  - スキーマ定義とバリデーション"
echo "  - 制約条件システムの詳細説明"
echo "  - 日本語対応のドキュメント"
echo ""
echo "🚀 Swagger UI でAPIを実際に試行できます！"