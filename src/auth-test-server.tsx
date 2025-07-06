/**
 * 認証機能のテスト専用サーバー
 * 認証関連のAPIのみをテスト
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import authRouter from './routes/auth'
import { errorHandler } from './lib/error-handler'
import { performanceMonitor } from './lib/performance-monitor'
import { startCacheCleanup } from './lib/cache-system'

type Env = {
  DB: D1Database
  GEMINI_API_KEY: string
  AUTH0_DOMAIN: string
  AUTH0_AUDIENCE: string
  AUTH0_CLIENT_ID: string
  NODE_ENV: string
}

const app = new Hono<{ Bindings: Env }>()

// グローバルミドルウェア
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

app.use('*', errorHandler())
app.use('*', performanceMonitor())

// キャッシュクリーンアップ開始
app.use('*', async (c, next) => {
  startCacheCleanup()
  return await next()
})

// ルートページ
app.get('/', (c) => {
  return c.html(
    <html>
      <head>
        <title>Auth Test Server</title>
        <style>{`
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #333; }
          .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
          .method { color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 12px; }
          .get { background: #28a745; }
          .post { background: #007bff; }
        `}</style>
      </head>
      <body>
        <h1>🔐 Auth0認証テストサーバー</h1>
        <p>認証機能のテストエンドポイント</p>
        
        <h2>認証設定・状態確認</h2>
        <div class="endpoint">
          <span class="method get">GET</span> /api/auth/status - Auth0設定状態確認
        </div>
        <div class="endpoint">
          <span class="method get">GET</span> /api/auth/health - 認証ヘルスチェック
        </div>
        <div class="endpoint">
          <span class="method get">GET</span> /api/auth/config - Auth0設定情報取得
        </div>
        
        <h2>認証テスト</h2>
        <div class="endpoint">
          <span class="method get">GET</span> /api/auth/user/me - ユーザー情報取得
        </div>
        <div class="endpoint">
          <span class="method get">GET</span> /api/auth/user/permissions - ユーザー権限一覧
        </div>
        <div class="endpoint">
          <span class="method post">POST</span> /api/auth/verify - JWTトークン検証
        </div>
        
        <h2>開発環境用モック</h2>
        <div class="endpoint">
          <span class="method post">POST</span> /api/auth/mock/token - モックトークン生成
        </div>
        <div class="endpoint">
          <span class="method post">POST</span> /api/auth/mock/user - カスタムモックユーザー生成
        </div>
        
        <h2>テスト実行</h2>
        <p>ターミナルで以下を実行:</p>
        <pre><code>./test-auth-simple.sh</code></pre>
        
        <h2>設定済みAuth0情報</h2>
        <p>wrangler.jsoncに設定された値が使用されます</p>
      </body>
    </html>
  )
})

// 認証API
app.route('/api/auth', authRouter)

// 簡単な接続テスト
app.get('/api/test', (c) => {
  return c.json({
    success: true,
    message: 'Auth test server is running',
    timestamp: new Date().toISOString(),
    env: {
      authDomain: c.env.AUTH0_DOMAIN || 'not configured',
      nodeEnv: c.env.NODE_ENV || 'development'
    }
  })
})

export default app