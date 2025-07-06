/**
 * 認証テスト専用の最小サーバー
 * ビルドエラーを回避して認証機能のみテスト
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'

// 最小限の型定義
type Env = {
  AUTH0_DOMAIN: string
  AUTH0_AUDIENCE: string
  AUTH0_CLIENT_ID: string
  NODE_ENV: string
}

const app = new Hono<{ Bindings: Env }>()

// CORS設定
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

// 基本テストエンドポイント
app.get('/api/test', (c) => {
  return c.json({
    success: true,
    message: 'Minimal auth test server is running',
    timestamp: new Date().toISOString()
  })
})

// Auth0設定状態確認
app.get('/api/auth/status', (c) => {
  const domain = c.env.AUTH0_DOMAIN || 'not configured'
  const audience = c.env.AUTH0_AUDIENCE || 'not configured'
  const clientId = c.env.AUTH0_CLIENT_ID || 'not configured'
  
  const isConfigured = domain !== 'not configured' && 
                      audience !== 'not configured' && 
                      clientId !== 'not configured'
  
  return c.json({
    success: true,
    data: {
      isConfigured,
      domain,
      audience,
      clientId: clientId !== 'not configured' ? clientId.substring(0, 8) + '...' : 'not configured',
      timestamp: new Date().toISOString()
    }
  })
})

// Auth0設定情報取得（フロントエンド用）
app.get('/api/auth/config', (c) => {
  return c.json({
    success: true,
    data: {
      domain: c.env.AUTH0_DOMAIN || 'not-configured',
      audience: c.env.AUTH0_AUDIENCE || 'not-configured',
      clientId: c.env.AUTH0_CLIENT_ID || 'not-configured',
      configured: !!(c.env.AUTH0_DOMAIN && c.env.AUTH0_AUDIENCE && c.env.AUTH0_CLIENT_ID)
    }
  })
})

// モック認証機能
app.post('/api/auth/mock/token', (c) => {
  // 本番環境では無効化
  if (c.env.NODE_ENV === 'production') {
    return c.json({
      success: false,
      error: 'FORBIDDEN_OPERATION',
      message: 'Mock authentication is not available in production'
    }, 403)
  }

  return c.json({
    success: true,
    data: {
      token: 'mock',
      user: {
        id: 'auth0|mock-user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'school_admin',
        schoolId: 'school-1'
      },
      note: 'This is a mock token for development only. Use "Bearer mock" in Authorization header.'
    }
  })
})

// カスタムモックユーザー生成
app.post('/api/auth/mock/user', async (c) => {
  if (c.env.NODE_ENV === 'production') {
    return c.json({
      success: false,
      error: 'FORBIDDEN_OPERATION',
      message: 'Mock authentication is not available in production'
    }, 403)
  }

  try {
    const body = await c.req.json()
    const {
      email = 'test@example.com',
      name = 'Test User',
      role = 'school_admin',
      schoolId = 'school-1',
      permissions = []
    } = body

    return c.json({
      success: true,
      data: {
        token: 'mock',
        user: {
          id: 'auth0|mock-user-123',
          email,
          name,
          role,
          schoolId,
          permissions
        },
        note: 'Custom mock user created for development. Use "Bearer mock" in Authorization header.'
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Invalid JSON in request body'
    }, 400)
  }
})

// モック認証でのユーザー情報取得
app.get('/api/auth/user/me', (c) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authorization header with Bearer token is required'
    }, 401)
  }

  const token = authHeader.replace('Bearer ', '')
  
  // モック認証の場合
  if (token === 'mock') {
    return c.json({
      success: true,
      data: {
        user: {
          id: 'auth0|mock-user-123',
          email: 'test@example.com',
          email_verified: true,
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg'
        },
        auth: {
          role: 'school_admin',
          schoolId: 'school-1',
          permissions: ['schools:read', 'schools:write', 'timetables:generate']
        },
        metadata: {
          role: 'school_admin',
          schoolId: 'school-1'
        }
      }
    })
  }

  // 実際のJWT検証はここで行う（今回は簡略化）
  return c.json({
    success: false,
    error: 'AUTHENTICATION_FAILED',
    message: 'Token verification failed'
  }, 401)
})

// JWT検証
app.post('/api/auth/verify', (c) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authorization header with Bearer token is required'
    }, 401)
  }

  const token = authHeader.replace('Bearer ', '')
  
  // モック認証の場合
  if (token === 'mock') {
    return c.json({
      success: true,
      data: {
        valid: true,
        user: {
          id: 'auth0|mock-user-123',
          email: 'test@example.com',
          role: 'school_admin'
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        issued: new Date().toISOString()
      }
    })
  }

  // 実際のJWT検証はここで行う（今回は簡略化）
  return c.json({
    success: false,
    error: 'AUTHENTICATION_FAILED',
    message: 'Token verification failed'
  }, 401)
})

// ユーザー権限一覧
app.get('/api/auth/user/permissions', (c) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authorization header with Bearer token is required'
    }, 401)
  }

  const token = authHeader.replace('Bearer ', '')
  
  // モック認証の場合
  if (token === 'mock') {
    return c.json({
      success: true,
      data: {
        role: 'school_admin',
        schoolId: 'school-1',
        permissions: [
          'schools:read', 'schools:write',
          'classes:read', 'classes:write',
          'teachers:read', 'teachers:write',
          'subjects:read', 'subjects:write',
          'timetables:read', 'timetables:write', 'timetables:generate'
        ],
        effectivePermissions: {
          isUnlimited: false,
          explicitPermissions: [],
          roleBasedPermissions: [
            'schools:read', 'schools:write',
            'timetables:read', 'timetables:write', 'timetables:generate'
          ]
        }
      }
    })
  }

  return c.json({
    success: false,
    error: 'AUTHENTICATION_FAILED',
    message: 'Token verification failed'
  }, 401)
})

// ルートページ
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Auth Test Server</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .method { color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 12px; }
        .get { background: #28a745; }
        .post { background: #007bff; }
      </style>
    </head>
    <body>
      <h1>🔐 Auth Test Server</h1>
      <p>認証テスト用最小サーバー</p>
      
      <h2>利用可能なエンドポイント</h2>
      <div class="endpoint"><span class="method get">GET</span> /api/test - 基本テスト</div>
      <div class="endpoint"><span class="method get">GET</span> /api/auth/status - Auth0設定状態</div>
      <div class="endpoint"><span class="method get">GET</span> /api/auth/config - Auth0設定情報</div>
      <div class="endpoint"><span class="method post">POST</span> /api/auth/mock/token - モックトークン生成</div>
      <div class="endpoint"><span class="method get">GET</span> /api/auth/user/me - ユーザー情報取得</div>
      <div class="endpoint"><span class="method post">POST</span> /api/auth/verify - JWT検証</div>
      
      <h2>HTMLテストページ</h2>
      <p><a href="test-auth.html">認証テストページを開く</a></p>
    </body>
    </html>
  `)
})

export default app