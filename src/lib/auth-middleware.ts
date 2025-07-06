/**
 * JWT認証ミドルウェア
 * Auth0トークンの検証とリクエストコンテキスト設定
 */

import type { Context, Next } from 'hono'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import {
  type Auth0User,
  type AuthContext,
  canAccessSchool,
  createAuthContext,
  createMockUser,
  extractTokenFromHeader,
  hasPermission,
  type UserRole,
  verifyAuth0Token,
} from './auth0'
import { ERROR_CODES, sendErrorResponse } from './error-handler'

declare module 'hono' {
  interface ContextVariableMap {
    authUser: Auth0User
    authContext: AuthContext
  }
}

/**
 * JWT認証ミドルウェア
 */
export function jwtAuth(options: { required?: boolean; allowMock?: boolean } = {}) {
  const { required = true, allowMock = false } = options

  return createMiddleware(async (c: Context, next: Next) => {
    const requestId = c.get('requestId')

    try {
      const authHeader = c.req.header('Authorization')
      const token = extractTokenFromHeader(authHeader)

      // モック認証（開発環境用）
      if (allowMock && (!token || token === 'mock')) {
        const mockUser = createMockUser()
        const authContext = createAuthContext(mockUser)

        c.set('authUser', mockUser)
        c.set('authContext', authContext)

        return await next()
      }

      // トークンが必要だが提供されていない場合
      if (required && !token) {
        return sendErrorResponse(
          c,
          ERROR_CODES.AUTHENTICATION_REQUIRED,
          'Authorization header with Bearer token is required',
          undefined,
          requestId
        )
      }

      // トークンが提供されていない場合（オプショナル認証）
      if (!token) {
        return await next()
      }

      // JWTトークンを検証
      const user = await verifyAuth0Token(token)
      const authContext = createAuthContext(user)

      // コンテキストに認証情報を設定
      c.set('authUser', user)
      c.set('authContext', authContext)

      return await next()
    } catch (error: any) {
      console.error('Authentication error:', error)

      return sendErrorResponse(
        c,
        ERROR_CODES.AUTHENTICATION_FAILED,
        `Token verification failed: ${error.message}`,
        undefined,
        requestId
      )
    }
  })
}

/**
 * 権限チェックミドルウェア
 */
export function requirePermission(permission: string) {
  return createMiddleware(async (c: Context, next: Next) => {
    const user = c.get('authUser')
    const requestId = c.get('requestId')

    if (!user) {
      return sendErrorResponse(
        c,
        ERROR_CODES.AUTHENTICATION_REQUIRED,
        'Authentication required to access this resource',
        undefined,
        requestId
      )
    }

    if (!hasPermission(user, permission)) {
      return sendErrorResponse(
        c,
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        `Permission '${permission}' is required to access this resource`,
        {
          userRole: user[`https://school-timetable.app/user_metadata`]?.role || 'unknown',
          requiredPermission: permission,
        },
        requestId
      )
    }

    return await next()
  })
}

/**
 * ロールチェックミドルウェア
 */
export function requireRole(roles: UserRole | UserRole[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles]

  return createMiddleware(async (c: Context, next: Next) => {
    const authContext = c.get('authContext')
    const requestId = c.get('requestId')

    if (!authContext) {
      return sendErrorResponse(
        c,
        ERROR_CODES.AUTHENTICATION_REQUIRED,
        'Authentication required to access this resource',
        undefined,
        requestId
      )
    }

    if (!allowedRoles.includes(authContext.role)) {
      return sendErrorResponse(
        c,
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        `One of the following roles is required: ${allowedRoles.join(', ')}`,
        {
          userRole: authContext.role,
          requiredRoles: allowedRoles,
        },
        requestId
      )
    }

    return await next()
  })
}

/**
 * 学校アクセス権限チェックミドルウェア
 */
export function requireSchoolAccess(getSchoolId?: (c: Context) => string) {
  return createMiddleware(async (c: Context, next: Next) => {
    const user = c.get('authUser')
    const requestId = c.get('requestId')

    if (!user) {
      return sendErrorResponse(
        c,
        ERROR_CODES.AUTHENTICATION_REQUIRED,
        'Authentication required to access this resource',
        undefined,
        requestId
      )
    }

    // 学校IDを取得（パラメータまたはカスタム関数から）
    const schoolId = getSchoolId ? getSchoolId(c) : c.req.param('schoolId')

    if (!schoolId) {
      return sendErrorResponse(
        c,
        ERROR_CODES.INVALID_REQUEST,
        'School ID is required for this operation',
        undefined,
        requestId
      )
    }

    if (!canAccessSchool(user, schoolId)) {
      return sendErrorResponse(
        c,
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        'Access denied: You do not have permission to access this school',
        { schoolId },
        requestId
      )
    }

    return await next()
  })
}

/**
 * 開発環境用認証スキップミドルウェア
 */
export function devAuth() {
  return createMiddleware(async (c: Context, next: Next) => {
    const isDev = process.env.NODE_ENV === 'development'

    if (isDev) {
      // 開発環境ではモックユーザーを使用
      const mockUser = createMockUser()
      const authContext = createAuthContext(mockUser)

      c.set('authUser', mockUser)
      c.set('authContext', authContext)
    }

    return await next()
  })
}

/**
 * 管理者専用ミドルウェア
 */
export function adminOnly() {
  return requireRole(['super_admin', 'school_admin'])
}

/**
 * スーパー管理者専用ミドルウェア
 */
export function superAdminOnly() {
  return requireRole('super_admin')
}

/**
 * 認証情報をレスポンスヘッダーに追加するミドルウェア
 */
export function addAuthHeaders() {
  return createMiddleware(async (c: Context, next: Next) => {
    await next()

    const authContext = c.get('authContext')
    if (authContext) {
      c.header('X-User-Role', authContext.role)
      if (authContext.schoolId) {
        c.header('X-User-School-Id', authContext.schoolId)
      }
      c.header('X-User-Permissions', authContext.permissions.join(','))
    }
  })
}

/**
 * 認証状態の検証（ヘルスチェック用）
 */
export async function validateAuthSetup(): Promise<{
  isConfigured: boolean
  domain: string
  audience: string
  issues: string[]
}> {
  const issues: string[] = []

  const domain = process.env.AUTH0_DOMAIN
  const audience = process.env.AUTH0_AUDIENCE

  if (!domain) {
    issues.push('AUTH0_DOMAIN environment variable is not set')
  }

  if (!audience) {
    issues.push('AUTH0_AUDIENCE environment variable is not set')
  }

  if (domain && domain === 'your-domain.auth0.com') {
    issues.push('AUTH0_DOMAIN is using placeholder value')
  }

  if (audience && audience === 'https://api.school-timetable.app') {
    issues.push('AUTH0_AUDIENCE may be using placeholder value')
  }

  return {
    isConfigured: issues.length === 0,
    domain: domain || 'not configured',
    audience: audience || 'not configured',
    issues,
  }
}
