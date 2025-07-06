/**
 * ユーザー管理サービス
 * Auth0認証とデータベースユーザーの統合
 */

import type { DrizzleDb } from './db'
import { eq, and } from 'drizzle-orm'
import { users, userRoles, userSessions } from '../db/schema'
import type { Auth0User, UserRole, AuthContext } from './auth0'
import { cachedQuery, getCache } from './cache-system'

export interface DatabaseUser {
  id: string
  auth0Id: string
  schoolId: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  profileData?: Record<string, any>
}

export interface UserSessionInfo {
  sessionId: string
  userId: string
  auth0Id: string
  startedAt: string
  lastActivityAt: string
  ipAddress?: string
  userAgent?: string
  isActive: boolean
}

/**
 * Auth0ユーザーをデータベースユーザーと同期
 */
export async function syncUserWithDatabase(
  db: DrizzleDb,
  auth0User: Auth0User,
  authContext: AuthContext
): Promise<DatabaseUser> {
  const cacheKey = `user-sync:${auth0User.sub}`
  
  return await cachedQuery(cacheKey, async () => {
    // 既存ユーザーを検索
    let dbUser = await db
      .select()
      .from(users)
      .where(eq(users.auth0Id, auth0User.sub))
      .get()

    const userData = {
      auth0Id: auth0User.sub,
      schoolId: authContext.schoolId || '',
      email: auth0User.email,
      name: auth0User.name || auth0User.email,
      role: authContext.role,
      lastLoginAt: new Date().toISOString(),
      profileData: {
        picture: auth0User.picture,
        email_verified: auth0User.email_verified,
        auth0_metadata: auth0User['https://school-timetable.app/user_metadata'] || {}
      }
    }

    if (dbUser) {
      // 既存ユーザーを更新
      dbUser = await db
        .update(users)
        .set({
          ...userData,
          updatedAt: new Date().toISOString()
        })
        .where(eq(users.id, dbUser.id))
        .returning()
        .get()
    } else {
      // 新規ユーザーを作成
      dbUser = await db
        .insert(users)
        .values({
          ...userData,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .returning()
        .get()
    }

    return dbUser as DatabaseUser
  }, 300000) // 5分キャッシュ
}

/**
 * ユーザーセッションを記録
 */
export async function createUserSession(
  db: DrizzleDb,
  userId: string,
  auth0Id: string,
  sessionInfo: {
    ipAddress?: string
    userAgent?: string
  }
): Promise<UserSessionInfo> {
  const sessionData = {
    userId,
    auth0Id,
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    ipAddress: sessionInfo.ipAddress,
    userAgent: sessionInfo.userAgent,
    isActive: true
  }

  const session = await db
    .insert(userSessions)
    .values(sessionData)
    .returning()
    .get()

  return session as UserSessionInfo
}

/**
 * ユーザーセッションを更新
 */
export async function updateUserSession(
  db: DrizzleDb,
  sessionId: string,
  updateData: {
    lastActivityAt?: string
    ipAddress?: string
    userAgent?: string
    isActive?: boolean
  }
): Promise<void> {
  await db
    .update(userSessions)
    .set({
      ...updateData,
      lastActivityAt: updateData.lastActivityAt || new Date().toISOString()
    })
    .where(eq(userSessions.id, sessionId))
}

/**
 * ユーザーの有効なセッション一覧を取得
 */
export async function getUserActiveSessions(
  db: DrizzleDb,
  auth0Id: string
): Promise<UserSessionInfo[]> {
  const sessions = await db
    .select()
    .from(userSessions)
    .where(and(
      eq(userSessions.auth0Id, auth0Id),
      eq(userSessions.isActive, true)
    ))
    .orderBy(userSessions.lastActivityAt)

  return sessions as UserSessionInfo[]
}

/**
 * 非アクティブセッションのクリーンアップ
 */
export async function cleanupInactiveSessions(
  db: DrizzleDb,
  maxAgeHours: number = 24
): Promise<number> {
  const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000)
  
  const result = await db
    .update(userSessions)
    .set({ isActive: false })
    .where(
      and(
        eq(userSessions.isActive, true),
        // SQLite用の日付比較
        //@ts-ignore
        userSessions.lastActivityAt < cutoffTime.toISOString()
      )
    )

  return result.changes || 0
}

/**
 * 学校内のユーザー一覧を取得
 */
export async function getSchoolUsers(
  db: DrizzleDb,
  schoolId: string,
  options: {
    role?: UserRole
    isActive?: boolean
    useCache?: boolean
  } = {}
): Promise<DatabaseUser[]> {
  const { role, isActive = true, useCache = true } = options
  
  const queryFn = async () => {
    let query = db
      .select()
      .from(users)
      .where(and(
        eq(users.schoolId, schoolId),
        eq(users.isActive, isActive)
      ))

    if (role) {
      query = query.where(eq(users.role, role))
    }

    return await query.orderBy(users.name)
  }

  if (useCache) {
    const cacheKey = `school-users:${schoolId}:${role || 'all'}:${isActive}`
    return await cachedQuery(cacheKey, queryFn, 600000) // 10分キャッシュ
  }

  return await queryFn()
}

/**
 * ユーザーロールを更新
 */
export async function updateUserRole(
  db: DrizzleDb,
  userId: string,
  newRole: UserRole,
  updatedBy: string
): Promise<DatabaseUser> {
  // ロール変更履歴を記録
  await db
    .insert(userRoles)
    .values({
      userId,
      role: newRole,
      assignedBy: updatedBy,
      assignedAt: new Date().toISOString(),
      isActive: true
    })

  // 古いロールを無効化
  await db
    .update(userRoles)
    .set({ isActive: false })
    .where(and(
      eq(userRoles.userId, userId),
      eq(userRoles.isActive, true)
    ))

  // ユーザーテーブルも更新
  const updatedUser = await db
    .update(users)
    .set({
      role: newRole,
      updatedAt: new Date().toISOString()
    })
    .where(eq(users.id, userId))
    .returning()
    .get()

  // キャッシュをクリア
  const cache = getCache('database-queries')
  cache.clear(`user-sync:*`)
  cache.clear(`school-users:*`)

  return updatedUser as DatabaseUser
}

/**
 * ユーザーを非アクティブ化
 */
export async function deactivateUser(
  db: DrizzleDb,
  userId: string,
  deactivatedBy: string
): Promise<void> {
  await db
    .update(users)
    .set({
      isActive: false,
      updatedAt: new Date().toISOString()
    })
    .where(eq(users.id, userId))

  // アクティブなセッションも無効化
  await db
    .update(userSessions)
    .set({ isActive: false })
    .where(eq(userSessions.userId, userId))

  // キャッシュをクリア
  const cache = getCache('database-queries')
  cache.clear(`user-sync:*`)
  cache.clear(`school-users:*`)
}

/**
 * ユーザー統計情報を取得
 */
export async function getUserStatistics(
  db: DrizzleDb,
  schoolId?: string
): Promise<{
  totalUsers: number
  activeUsers: number
  usersByRole: Record<UserRole, number>
  recentLoginCount: number
}> {
  const cacheKey = `user-stats:${schoolId || 'global'}`
  
  return await cachedQuery(cacheKey, async () => {
    let baseQuery = db.select().from(users)
    
    if (schoolId) {
      baseQuery = baseQuery.where(eq(users.schoolId, schoolId))
    }

    const allUsers = await baseQuery
    const activeUsers = allUsers.filter(u => u.isActive)
    
    // ロール別カウント
    const usersByRole = activeUsers.reduce((acc, user) => {
      acc[user.role as UserRole] = (acc[user.role as UserRole] || 0) + 1
      return acc
    }, {} as Record<UserRole, number>)

    // 過去24時間のログイン数
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const recentLogins = activeUsers.filter(u => 
      u.lastLoginAt && u.lastLoginAt > yesterday
    )

    return {
      totalUsers: allUsers.length,
      activeUsers: activeUsers.length,
      usersByRole,
      recentLoginCount: recentLogins.length
    }
  }, 300000) // 5分キャッシュ
}

/**
 * Auth0ユーザーとデータベースユーザーの整合性チェック
 */
export async function validateUserIntegrity(
  db: DrizzleDb,
  auth0Id: string
): Promise<{
  isValid: boolean
  issues: string[]
  user?: DatabaseUser
}> {
  const issues: string[] = []
  
  try {
    const dbUser = await db
      .select()
      .from(users)
      .where(eq(users.auth0Id, auth0Id))
      .get()

    if (!dbUser) {
      issues.push('Database user not found for Auth0 ID')
      return { isValid: false, issues }
    }

    if (!dbUser.isActive) {
      issues.push('Database user is inactive')
    }

    if (!dbUser.schoolId && dbUser.role !== 'super_admin') {
      issues.push('User has no school assignment')
    }

    return {
      isValid: issues.length === 0,
      issues,
      user: dbUser as DatabaseUser
    }
  } catch (error: any) {
    issues.push(`Database validation error: ${error.message}`)
    return { isValid: false, issues }
  }
}