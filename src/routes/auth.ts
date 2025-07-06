/**
 * 認証関連API
 * Auth0認証状態の確認、ユーザー情報取得、認証テスト
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../lib/db'
import { jwtAuth, validateAuthSetup } from '../lib/auth-middleware'
import { createAuthContext, createMockUser } from '../lib/auth0'
import { sendErrorResponse, ERROR_CODES, errorHandler } from '../lib/error-handler'

const app = new Hono<{ Bindings: Env }>()
app.use('*', errorHandler())

// 認証不要なエンドポイント
app.get('/status', async (c) => {
  const requestId = c.get('requestId')
  
  try {
    const authSetup = await validateAuthSetup()
    
    return c.json({
      success: true,
      data: {
        ...authSetup,
        timestamp: new Date().toISOString()
      },
      requestId
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
  }
})

// ヘルスチェック（認証設定状態確認）
app.get('/health', async (c) => {
  const requestId = c.get('requestId')
  
  try {
    const authSetup = await validateAuthSetup()
    const isHealthy = authSetup.isConfigured
    
    return c.json({
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'configuration_required',
        auth0: {
          configured: authSetup.isConfigured,
          domain: authSetup.domain !== 'not configured',
          audience: authSetup.audience !== 'not configured'
        },
        issues: authSetup.issues,
        timestamp: new Date().toISOString()
      },
      requestId
    }, isHealthy ? 200 : 503)
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
  }
})

// 認証が必要なエンドポイント
app.use('/user/*', jwtAuth({ allowMock: true }))
app.use('/verify', jwtAuth({ allowMock: true }))

// 現在の認証ユーザー情報取得
app.get('/user/me', (c) => {
  const authUser = c.get('authUser')
  const authContext = c.get('authContext')
  const requestId = c.get('requestId')

  if (!authUser || !authContext) {
    return sendErrorResponse(
      c,
      ERROR_CODES.AUTHENTICATION_REQUIRED,
      'Authentication required',
      undefined,
      requestId
    )
  }

  return c.json({
    success: true,
    data: {
      user: {
        id: authUser.sub,
        email: authUser.email,
        email_verified: authUser.email_verified,
        name: authUser.name,
        picture: authUser.picture
      },
      auth: {
        role: authContext.role,
        schoolId: authContext.schoolId,
        permissions: authContext.permissions
      },
      metadata: authUser['https://school-timetable.app/user_metadata'] || {}
    },
    requestId
  })
})

// ユーザーの権限一覧取得
app.get('/user/permissions', (c) => {
  const authContext = c.get('authContext')
  const requestId = c.get('requestId')

  if (!authContext) {
    return sendErrorResponse(
      c,
      ERROR_CODES.AUTHENTICATION_REQUIRED,
      'Authentication required',
      undefined,
      requestId
    )
  }

  // ロールベースの権限を含む全権限を計算
  const allPermissions = new Set(authContext.permissions)
  
  // ロールベースの権限を追加
  const rolePermissions: Record<string, string[]> = {
    'super_admin': ['*'],
    'school_admin': [
      'schools:read', 'schools:write',
      'classes:read', 'classes:write',
      'teachers:read', 'teachers:write',
      'subjects:read', 'subjects:write',
      'classrooms:read', 'classrooms:write',
      'timetables:read', 'timetables:write', 'timetables:generate',
      'constraints:read', 'constraints:write',
      'users:read', 'users:write'
    ],
    'teacher': [
      'schools:read', 'classes:read', 'teachers:read',
      'subjects:read', 'classrooms:read', 'timetables:read',
      'constraints:read'
    ],
    'viewer': [
      'schools:read', 'classes:read', 'teachers:read',
      'subjects:read', 'classrooms:read', 'timetables:read'
    ]
  }

  const rolePerms = rolePermissions[authContext.role] || []
  rolePerms.forEach(perm => allPermissions.add(perm))

  return c.json({
    success: true,
    data: {
      role: authContext.role,
      schoolId: authContext.schoolId,
      permissions: Array.from(allPermissions),
      effectivePermissions: {
        isUnlimited: allPermissions.has('*'),
        explicitPermissions: authContext.permissions,
        roleBasedPermissions: rolePerms
      }
    },
    requestId
  })
})

// JWTトークン検証
app.post('/verify', (c) => {
  const authUser = c.get('authUser')
  const authContext = c.get('authContext')
  const requestId = c.get('requestId')

  if (!authUser || !authContext) {
    return sendErrorResponse(
      c,
      ERROR_CODES.AUTHENTICATION_FAILED,
      'Token verification failed',
      undefined,
      requestId
    )
  }

  return c.json({
    success: true,
    data: {
      valid: true,
      user: {
        id: authUser.sub,
        email: authUser.email,
        role: authContext.role
      },
      expires: authUser.exp ? new Date(authUser.exp * 1000).toISOString() : null,
      issued: authUser.iat ? new Date(authUser.iat * 1000).toISOString() : null
    },
    requestId
  })
})

// 開発環境用: モックトークン生成
app.post('/mock/token', (c) => {
  const requestId = c.get('requestId')
  
  // 本番環境では無効化
  if (process.env.NODE_ENV === 'production') {
    return sendErrorResponse(
      c,
      ERROR_CODES.FORBIDDEN_OPERATION,
      'Mock authentication is not available in production',
      undefined,
      requestId
    )
  }

  const mockUser = createMockUser()
  const authContext = createAuthContext(mockUser)

  return c.json({
    success: true,
    data: {
      token: 'mock', // フロントエンドはこの値をAuthorizationヘッダーで送信
      user: {
        id: mockUser.sub,
        email: mockUser.email,
        name: mockUser.name,
        role: authContext.role,
        schoolId: authContext.schoolId
      },
      note: 'This is a mock token for development only. Use "Bearer mock" in Authorization header.'
    },
    requestId
  })
})

// 開発環境用: カスタムモックユーザー生成
const MockUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  role: z.enum(['super_admin', 'school_admin', 'teacher', 'viewer']).optional(),
  schoolId: z.string().optional(),
  permissions: z.array(z.string()).optional()
})

app.post('/mock/user',
  zValidator('json', MockUserSchema),
  (c) => {
    const requestId = c.get('requestId')
    
    // 本番環境では無効化
    if (process.env.NODE_ENV === 'production') {
      return sendErrorResponse(
        c,
        ERROR_CODES.FORBIDDEN_OPERATION,
        'Mock authentication is not available in production',
        undefined,
        requestId
      )
    }

    const config = c.req.valid('json')
    
    const mockUser = createMockUser({
      email: config.email || 'test@example.com',
      name: config.name || 'Test User',
      permissions: config.permissions || [],
      'https://school-timetable.app/user_metadata': {
        role: config.role || 'school_admin',
        schoolId: config.schoolId || 'school-1',
        permissions: config.permissions || []
      }
    })

    const authContext = createAuthContext(mockUser)

    return c.json({
      success: true,
      data: {
        token: 'mock', // フロントエンドで使用
        user: {
          id: mockUser.sub,
          email: mockUser.email,
          name: mockUser.name,
          role: authContext.role,
          schoolId: authContext.schoolId,
          permissions: authContext.permissions
        },
        note: 'Custom mock user created for development. Use "Bearer mock" in Authorization header.'
      },
      requestId
    })
  }
)

// Auth0設定情報取得（公開エンドポイント）
app.get('/config', (c) => {
  const requestId = c.get('requestId')
  
  return c.json({
    success: true,
    data: {
      domain: process.env.AUTH0_DOMAIN || 'not-configured',
      audience: process.env.AUTH0_AUDIENCE || 'not-configured',
      clientId: process.env.AUTH0_CLIENT_ID || 'not-configured',
      // セキュリティ上、実際の値ではなく設定状態のみ返す
      configured: !!(process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE),
      loginUrl: process.env.AUTH0_DOMAIN ? 
        `https://${process.env.AUTH0_DOMAIN}/authorize` : null,
      logoutUrl: process.env.AUTH0_DOMAIN ? 
        `https://${process.env.AUTH0_DOMAIN}/v2/logout` : null
    },
    requestId
  })
})

export default app