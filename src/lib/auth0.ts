/**
 * Auth0認証統合
 * JWT検証とユーザー情報取得
 */

import { Context } from 'hono'
import { verify } from 'hono/jwt'
import { createRemoteJWKSet, jwtVerify } from 'jose'

export interface Auth0User {
  sub: string // Auth0 user ID
  email: string
  email_verified: boolean
  name?: string
  picture?: string
  roles?: string[]
  permissions?: string[]
  // カスタムクレーム
  'https://school-timetable.app/user_metadata'?: {
    schoolId?: string
    role?: UserRole
    permissions?: string[]
  }
}

export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'viewer'

export interface AuthContext {
  user: Auth0User
  schoolId?: string
  role: UserRole
  permissions: string[]
}

/**
 * Auth0設定
 */
export class Auth0Config {
  public static readonly DOMAIN = process.env.AUTH0_DOMAIN || 'your-domain.auth0.com'
  public static readonly AUDIENCE = process.env.AUTH0_AUDIENCE || 'https://api.school-timetable.app'
  public static readonly ISSUER = `https://${Auth0Config.DOMAIN}/`
  public static readonly JWKS_URI = `${Auth0Config.ISSUER}.well-known/jwks.json`

  // カスタムクレームの名前空間
  public static readonly NAMESPACE = 'https://school-timetable.app/'
}

/**
 * JWT署名検証用のJWKSセット
 */
const JWKS = createRemoteJWKSet(new URL(Auth0Config.JWKS_URI))

/**
 * Auth0 JWTトークンを検証
 */
export async function verifyAuth0Token(token: string): Promise<Auth0User> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: Auth0Config.ISSUER,
      audience: Auth0Config.AUDIENCE,
    })

    return payload as unknown as Auth0User
  } catch (error: any) {
    throw new Error(`JWT verification failed: ${error.message}`)
  }
}

/**
 * Authorizationヘッダーからトークンを抽出
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null
  }

  return parts[1]
}

/**
 * ユーザーの権限をチェック
 */
export function hasPermission(user: Auth0User, permission: string): boolean {
  // 基本的な権限チェック
  if (user.permissions?.includes(permission)) {
    return true
  }

  // カスタムクレームからの権限チェック
  const customMetadata = user[`${Auth0Config.NAMESPACE}user_metadata`]
  if (customMetadata?.permissions?.includes(permission)) {
    return true
  }

  // ロールベースの権限チェック
  const role = getUserRole(user)
  return checkRolePermission(role, permission)
}

/**
 * ユーザーのロールを取得
 */
export function getUserRole(user: Auth0User): UserRole {
  // カスタムクレームからロール取得
  const customMetadata = user[`${Auth0Config.NAMESPACE}user_metadata`]
  if (customMetadata?.role) {
    return customMetadata.role
  }

  // Auth0のロールから推定
  if (user.roles?.includes('super_admin')) {
    return 'super_admin'
  }
  if (user.roles?.includes('school_admin')) {
    return 'school_admin'
  }
  if (user.roles?.includes('teacher')) {
    return 'teacher'
  }

  // デフォルトはviewer
  return 'viewer'
}

/**
 * ユーザーの所属学校IDを取得
 */
export function getUserSchoolId(user: Auth0User): string | undefined {
  const customMetadata = user[`${Auth0Config.NAMESPACE}user_metadata`]
  return customMetadata?.schoolId
}

/**
 * ロールベースの権限マッピング
 */
export function checkRolePermission(role: UserRole, permission: string): boolean {
  const rolePermissions: Record<UserRole, string[]> = {
    super_admin: ['*'], // すべての権限
    school_admin: [
      'schools:read',
      'schools:write',
      'classes:read',
      'classes:write',
      'teachers:read',
      'teachers:write',
      'subjects:read',
      'subjects:write',
      'classrooms:read',
      'classrooms:write',
      'timetables:read',
      'timetables:write',
      'timetables:generate',
      'constraints:read',
      'constraints:write',
      'users:read',
      'users:write',
    ],
    teacher: [
      'schools:read',
      'classes:read',
      'teachers:read',
      'subjects:read',
      'classrooms:read',
      'timetables:read',
      'constraints:read',
    ],
    viewer: [
      'schools:read',
      'classes:read',
      'teachers:read',
      'subjects:read',
      'classrooms:read',
      'timetables:read',
    ],
  }

  const userPermissions = rolePermissions[role] || []

  // スーパー管理者は全権限
  if (userPermissions.includes('*')) {
    return true
  }

  return userPermissions.includes(permission)
}

/**
 * 学校アクセス権限のチェック
 */
export function canAccessSchool(user: Auth0User, schoolId: string): boolean {
  const role = getUserRole(user)

  // スーパー管理者は全学校にアクセス可能
  if (role === 'super_admin') {
    return true
  }

  // その他のロールは所属学校のみ
  const userSchoolId = getUserSchoolId(user)
  return userSchoolId === schoolId
}

/**
 * Auth0認証コンテキストを作成
 */
export function createAuthContext(user: Auth0User): AuthContext {
  return {
    user,
    schoolId: getUserSchoolId(user),
    role: getUserRole(user),
    permissions: user.permissions || [],
  }
}

/**
 * Development/Test環境用のモックユーザー
 */
export function createMockUser(overrides: Partial<Auth0User> = {}): Auth0User {
  return {
    sub: 'auth0|mock-user-123',
    email: 'test@example.com',
    email_verified: true,
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    roles: ['school_admin'],
    permissions: ['schools:read', 'schools:write'],
    [`${Auth0Config.NAMESPACE}user_metadata`]: {
      schoolId: 'school-1',
      role: 'school_admin',
      permissions: ['schools:read', 'schools:write'],
    },
    ...overrides,
  }
}
