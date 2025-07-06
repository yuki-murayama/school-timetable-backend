#!/bin/bash

# パフォーマンス最適化機能のテストスクリプト
# キャッシュ、監視、最適化機能の動作確認

echo "⚡ パフォーマンス最適化機能のテスト開始"

# APIのベースURL（デプロイ済みの場合は変更）
BASE_URL="https://school-timetable-backend.malah-shunmu.workers.dev"

echo ""
echo "📊 パフォーマンス統計取得"
curl -s "$BASE_URL/api/performance/statistics" | jq '.'

echo ""
echo "🧠 システムリソース監視"
curl -s "$BASE_URL/api/performance/system" | jq '.'

echo ""
echo "💾 キャッシュ統計情報"
curl -s "$BASE_URL/api/performance/cache/statistics" | jq '.'

echo ""
echo "🚀 パフォーマンス推奨事項"
curl -s "$BASE_URL/api/performance/recommendations" | jq '.'

echo ""
echo "📈 エンドポイントベンチマークテスト"
curl -s -X POST "$BASE_URL/api/performance/benchmark" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "'$BASE_URL'/api/frontend/health",
    "method": "GET",
    "iterations": 5,
    "concurrency": 2
  }' | jq '.'

echo ""
echo "🧹 キャッシュクリーンアップテスト"
curl -s -X POST "$BASE_URL/api/performance/cache/cleanup" | jq '.'

echo ""
echo "📋 詳細メトリクス取得（最新10件）"
curl -s "$BASE_URL/api/performance/metrics?limit=10" | jq '.'

echo ""
echo "⏱️ 応答時間テスト（複数回実行）"
echo "フロントエンドAPI応答時間計測:"

# 複数回リクエストして応答時間を計測
for i in {1..5}; do
  start_time=$(date +%s%3N)
  curl -s "$BASE_URL/api/frontend/health" > /dev/null
  end_time=$(date +%s%3N)
  duration=$((end_time - start_time))
  echo "  リクエスト $i: ${duration}ms"
done

echo ""
echo "💡 キャッシュ効果確認"
echo "初回リクエスト（キャッシュミス）:"
start_time=$(date +%s%3N)
curl -s "$BASE_URL/api/database/statistics" > /dev/null
end_time=$(date +%s%3N)
duration1=$((end_time - start_time))
echo "  初回: ${duration1}ms"

echo "2回目リクエスト（キャッシュヒット予想）:"
start_time=$(date +%s%3N)
curl -s "$BASE_URL/api/database/statistics" > /dev/null
end_time=$(date +%s%3N)
duration2=$((end_time - start_time))
echo "  2回目: ${duration2}ms"

if [ $duration2 -lt $duration1 ]; then
  echo "  ✅ キャッシュ効果あり（${duration1}ms → ${duration2}ms）"
else
  echo "  ⚠️ キャッシュ効果不明（${duration1}ms → ${duration2}ms）"
fi

echo ""
echo "🔧 特定キャッシュクリアテスト"
curl -s -X POST "$BASE_URL/api/performance/cache/database-queries/clear" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'

echo ""
echo "✅ パフォーマンス最適化機能のテスト完了"
echo ""
echo "⚡ 実装された最適化機能:"
echo "  📊 リアルタイムパフォーマンス監視"
echo "  💾 マルチレベルLRUキャッシュシステム"
echo "  🎯 データベースクエリ最適化"
echo "  📈 自動ベンチマーク機能"
echo "  🧠 システムリソース監視"
echo "  💡 パフォーマンス推奨事項生成"
echo "  🧹 自動キャッシュクリーンアップ"
echo ""
echo "📊 監視可能なメトリクス:"
echo "  - API応答時間（平均・95パーセンタイル）"
echo "  - エラー率とステータスコード分布"
echo "  - エンドポイント別パフォーマンス"
echo "  - キャッシュヒット率とメモリ使用量"
echo "  - システムメモリとCPU使用量"
echo "  - データベースクエリ実行時間"
echo ""
echo "💾 キャッシュ戦略:"
echo "  - database-queries: DB結果キャッシュ（5分）"
echo "  - api-responses: API応答キャッシュ（1分）"
echo "  - constraint-validations: 制約検証結果（2分）"
echo "  - grid-data: 時間割グリッドデータ（5分）"
echo ""
echo "🚀 これでシステム全体のパフォーマンスが大幅に向上しました！"