/**
 * OpenAPI ドキュメントルーター
 * 全てのAPIドキュメント定義をまとめて管理
 */

import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../lib/db'

// ドキュメント定義のインポート
import { constraintRoutes } from './constraints'
import { timetableRoutes } from './timetables'

export function createDocsApp(): OpenAPIHono<{ Bindings: Env }> {
  const app = new OpenAPIHono<{ Bindings: Env }>()

  // OpenAPI ドキュメント設定
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'School Timetable API',
      description: `
# 学校時間割作成システム API

このAPIは学校の時間割作成と管理を支援するシステムです。

## 主な機能

### 🏫 基本データ管理
- **学校管理**: 学校の登録・編集・削除
- **クラス管理**: クラスの作成と学年設定
- **教師管理**: 教師情報の管理
- **教科管理**: 教科の登録と設定
- **教室管理**: 教室タイプと定員の管理

### 📅 時間割システム
- **時間割作成**: 学校単位での時間割テンプレート作成
- **バルク生成**: AI駆動による複数クラス一括時間割生成
- **制約条件**: 柔軟で拡張可能な制約システム

### 🔧 制約条件システム
拡張可能な制約条件システムにより、学校のニーズに応じた柔軟な時間割生成が可能です。

#### 標準制約条件
- **教師時間重複禁止**: 同一教師が同時間に複数クラスを担当することを防止
- **教室時間重複禁止**: 同一教室が同時間に複数クラスで使用されることを防止  
- **教科配置バランス**: 教科の適切な分散配置
- **時間帯配置優先**: 午前/午後の教科配置優先設定

#### カスタマイズ機能
- 制約条件の有効/無効切り替え
- パラメータの動的変更
- 新しい制約条件の追加

### 🤖 AI生成機能
Gemini 2.5 Pro を使用した高品質な時間割生成:
- 複雑な制約条件を考慮した最適化
- 学校特有の要件への対応
- リアルタイム制約検証

## 認証
現在このAPIは認証を必要としませんが、本番環境では適切な認証機構の実装を推奨します。

## レート制限
Cloudflare Workers の制限に準拠します。

## サポート
技術的な質問やフィードバックは GitHub Issues をご利用ください。
      `,
      contact: {
        name: 'API Support',
        email: 'support@school-timetable.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'https://school-timetable-backend.malah-shunmu.workers.dev',
        description: 'Production server (Cloudflare Workers)',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [
      {
        name: 'Schools',
        description: '🏫 学校管理 - 学校の基本情報を管理',
      },
      {
        name: 'Classes',
        description: '📚 クラス管理 - 学年・クラスの編成を管理',
      },
      {
        name: 'Teachers',
        description: '👨‍🏫 教師管理 - 教師情報と担当教科を管理',
      },
      {
        name: 'Subjects',
        description: '📖 教科管理 - 教科の登録と設定を管理',
      },
      {
        name: 'Classrooms',
        description: '🏛️ 教室管理 - 教室タイプと定員を管理',
      },
      {
        name: 'Timetables',
        description: '📅 時間割管理 - 時間割の作成・生成・管理',
      },
      {
        name: 'Constraints',
        description: '🔧 制約条件管理 - 拡張可能な制約システム',
      },
      {
        name: 'Test',
        description: '🧪 テスト用エンドポイント - 開発・テスト用機能',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer Token (将来の認証用)',
        },
      },
    },
  })

  // Swagger UI の設定
  app.get(
    '/ui',
    swaggerUI({
      url: '/docs/doc',
      config: {
        deepLinking: true,
        displayOperationId: false,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        defaultModelRendering: 'example',
        displayRequestDuration: true,
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
      },
    })
  )

  // OpenAPI JSON ダウンロード
  app.get('/openapi.json', c => {
    // ドキュメント生成の際に使用
    return c.json({
      message: 'OpenAPI仕様書をダウンロードするには /docs/doc にアクセスしてください',
    })
  })

  // カスタムドキュメントページ
  app.get('/', c => {
    return c.html(`
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>School Timetable API Documentation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; }
        .title { color: #2c3e50; margin-bottom: 10px; }
        .subtitle { color: #7f8c8d; margin-bottom: 30px; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .feature-card { border: 1px solid #e9ecef; border-radius: 6px; padding: 20px; }
        .feature-title { color: #2c3e50; margin-bottom: 10px; }
        .nav-links { display: flex; justify-content: center; gap: 20px; margin-top: 30px; }
        .nav-link { display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 6px; transition: background 0.3s; }
        .nav-link:hover { background: #2980b9; }
        .nav-link.primary { background: #e74c3c; }
        .nav-link.primary:hover { background: #c0392b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">🏫 School Timetable API</h1>
            <p class="subtitle">学校時間割作成システムのバックエンドAPI</p>
        </div>
        
        <div class="features">
            <div class="feature-card">
                <h3 class="feature-title">📅 AI駆動時間割生成</h3>
                <p>Gemini 2.5 Pro を使用した高品質な時間割の自動生成。複雑な制約条件を考慮した最適化が可能です。</p>
            </div>
            
            <div class="feature-card">
                <h3 class="feature-title">🔧 拡張可能制約システム</h3>
                <p>プラガブルアーキテクチャにより、学校のニーズに応じた制約条件を柔軟に追加・変更できます。</p>
            </div>
            
            <div class="feature-card">
                <h3 class="feature-title">📊 包括的データ管理</h3>
                <p>学校、クラス、教師、教科、教室の完全な管理機能を提供します。</p>
            </div>
            
            <div class="feature-card">
                <h3 class="feature-title">⚡ 高性能・スケーラブル</h3>
                <p>Cloudflare Workers とエッジコンピューティングによる高速レスポンスとグローバル展開。</p>
            </div>
        </div>
        
        <div class="nav-links">
            <a href="/docs/ui" class="nav-link primary">📖 Interactive API Docs</a>
            <a href="/docs/doc" class="nav-link">📄 OpenAPI Specification</a>
            <a href="/" class="nav-link">🏠 API Overview</a>
        </div>
    </div>
</body>
</html>
    `)
  })

  return app
}

// 全ルート定義を統合する関数
export function registerAllRoutes(app: OpenAPIHono<{ Bindings: Env }>) {
  // 制約条件関連のルート
  for (const route of constraintRoutes) {
    app.openapi(route, async c => {
      // 実際のハンドラーは既存のルーターから呼び出す
      return c.json({ message: 'このエンドポイントの実装は /api/constraints から利用してください' })
    })
  }

  // 時間割関連のルート
  for (const route of timetableRoutes) {
    app.openapi(route, async c => {
      // 実際のハンドラーは既存のルーターから呼び出す
      return c.json({ message: 'このエンドポイントの実装は /api/timetables から利用してください' })
    })
  }

  return app
}
