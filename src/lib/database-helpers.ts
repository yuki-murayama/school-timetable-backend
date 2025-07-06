/**
 * データベースヘルパー関数
 * 拡張されたスキーマに対応した管理・メンテナンス機能
 */

import type { DrizzleDb } from './db'
import { eq, and, desc, count, sql } from 'drizzle-orm'
import { 
  users, userSchools, schools, classes, teachers, subjects, classrooms,
  timetables, timetableHistory, schedules, constraintConfigurations,
  generationLogs, systemSettings, teacherSubjects, classroomSubjects
} from '../db/schema'

// データベース統計情報取得
export async function getDatabaseStatistics(db: DrizzleDb) {
  const stats = await Promise.all([
    db.select({ count: count() }).from(users).get(),
    db.select({ count: count() }).from(schools).get(),
    db.select({ count: count() }).from(classes).get(),
    db.select({ count: count() }).from(teachers).get(),
    db.select({ count: count() }).from(subjects).get(),
    db.select({ count: count() }).from(classrooms).get(),
    db.select({ count: count() }).from(timetables).get(),
    db.select({ count: count() }).from(schedules).get(),
    db.select({ count: count() }).from(generationLogs).get(),
  ])

  return {
    totalUsers: stats[0]?.count || 0,
    totalSchools: stats[1]?.count || 0,
    totalClasses: stats[2]?.count || 0,
    totalTeachers: stats[3]?.count || 0,
    totalSubjects: stats[4]?.count || 0,
    totalClassrooms: stats[5]?.count || 0,
    totalTimetables: stats[6]?.count || 0,
    totalSchedules: stats[7]?.count || 0,
    totalGenerationLogs: stats[8]?.count || 0,
  }
}

// 学校データの完全性チェック
export async function validateSchoolDataIntegrity(db: DrizzleDb, schoolId: string) {
  const issues = []

  // 基本データの存在確認
  const school = await db.select().from(schools).where(eq(schools.id, schoolId)).get()
  if (!school) {
    issues.push({ type: 'critical', message: '学校データが見つかりません' })
    return { isValid: false, issues }
  }

  // クラスと教師の関係チェック
  const classesWithoutHomeroom = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(and(
      eq(classes.schoolId, schoolId),
      eq(classes.isActive, true),
      sql`${classes.homeRoomTeacherId} IS NULL`
    ))

  if (classesWithoutHomeroom.length > 0) {
    issues.push({
      type: 'warning',
      message: `担任が設定されていないクラスがあります: ${classesWithoutHomeroom.map(c => c.name).join(', ')}`
    })
  }

  // 教師と教科の関係チェック
  const teachersWithoutSubjects = await db
    .select({ 
      teacher: teachers.name,
      teacherId: teachers.id 
    })
    .from(teachers)
    .leftJoin(teacherSubjects, eq(teachers.id, teacherSubjects.teacherId))
    .where(and(
      eq(teachers.schoolId, schoolId),
      eq(teachers.isActive, true),
      sql`${teacherSubjects.teacherId} IS NULL`
    ))

  if (teachersWithoutSubjects.length > 0) {
    issues.push({
      type: 'warning',
      message: `担当教科が設定されていない教師がいます: ${teachersWithoutSubjects.map(t => t.teacher).join(', ')}`
    })
  }

  // 時間割の整合性チェック
  const activeTimetables = await db
    .select()
    .from(timetables)
    .where(and(
      eq(timetables.schoolId, schoolId),
      eq(timetables.isActive, true)
    ))

  if (activeTimetables.length === 0) {
    issues.push({
      type: 'info',
      message: 'アクティブな時間割がありません'
    })
  } else if (activeTimetables.length > 1) {
    issues.push({
      type: 'warning',
      message: `複数のアクティブな時間割があります: ${activeTimetables.map(t => t.name).join(', ')}`
    })
  }

  return {
    isValid: issues.filter(i => i.type === 'critical').length === 0,
    issues
  }
}

// 時間割履歴の管理
export async function createTimetableSnapshot(
  db: DrizzleDb,
  timetableId: string,
  changeType: 'created' | 'updated' | 'approved' | 'archived',
  changeDescription: string,
  changedBy: string
) {
  // 現在の時間割データを取得
  const timetable = await db.select().from(timetables).where(eq(timetables.id, timetableId)).get()
  if (!timetable) {
    throw new Error('時間割が見つかりません')
  }

  // 関連するスケジュールデータを取得
  const currentSchedules = await db
    .select()
    .from(schedules)
    .where(eq(schedules.timetableId, timetableId))

  // スナップショットデータを作成
  const snapshotData = {
    timetable,
    schedules: currentSchedules,
    timestamp: new Date().toISOString()
  }

  // 履歴レコードを作成
  await db.insert(timetableHistory).values({
    timetableId,
    version: timetable.version,
    changeType,
    changeDescription,
    changedBy,
    snapshotData
  })
}

// 制約設定の管理
export async function updateSchoolConstraintSettings(
  db: DrizzleDb,
  schoolId: string,
  constraintType: string,
  settings: {
    isEnabled?: boolean
    priority?: number
    parameters?: Record<string, any>
  },
  updatedBy: string
) {
  const existingConfig = await db
    .select()
    .from(constraintConfigurations)
    .where(and(
      eq(constraintConfigurations.schoolId, schoolId),
      eq(constraintConfigurations.constraintType, constraintType)
    ))
    .get()

  if (existingConfig) {
    // 既存設定を更新
    await db
      .update(constraintConfigurations)
      .set({
        isEnabled: settings.isEnabled ?? existingConfig.isEnabled,
        priority: settings.priority ?? existingConfig.priority,
        parameters: settings.parameters ?? existingConfig.parameters,
        updatedAt: new Date().toISOString()
      })
      .where(eq(constraintConfigurations.id, existingConfig.id))
  } else {
    // 新規設定を作成
    await db.insert(constraintConfigurations).values({
      schoolId,
      constraintType,
      isEnabled: settings.isEnabled ?? true,
      priority: settings.priority ?? 5,
      parameters: settings.parameters ?? {},
      createdBy: updatedBy
    })
  }
}

// 生成ログの記録
export async function logTimetableGeneration(
  db: DrizzleDb,
  data: {
    timetableId: string
    generationType: 'single' | 'bulk' | 'manual'
    status: 'started' | 'completed' | 'failed'
    targetClasses?: string[]
    generationTime?: number
    errorMessage?: string
    constraintViolations?: any[]
    requestedBy?: string
  }
) {
  await db.insert(generationLogs).values({
    ...data,
    createdAt: new Date().toISOString()
  })
}

// システム設定の管理
export async function getSystemSetting(db: DrizzleDb, key: string) {
  const setting = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .get()
  
  return setting?.value
}

export async function setSystemSetting(
  db: DrizzleDb,
  key: string,
  value: any,
  options: {
    description?: string
    category?: string
    isPublic?: boolean
    updatedBy?: string
  } = {}
) {
  const existing = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .get()

  if (existing) {
    await db
      .update(systemSettings)
      .set({
        value,
        description: options.description ?? existing.description,
        category: options.category ?? existing.category,
        isPublic: options.isPublic ?? existing.isPublic,
        updatedBy: options.updatedBy,
        updatedAt: new Date().toISOString()
      })
      .where(eq(systemSettings.id, existing.id))
  } else {
    await db.insert(systemSettings).values({
      key,
      value,
      description: options.description,
      category: options.category ?? 'general',
      isPublic: options.isPublic ?? false,
      updatedBy: options.updatedBy
    })
  }
}

// データベースクリーンアップ
export async function cleanupOldData(db: DrizzleDb, options: {
  olderThanDays: number
  dryRun?: boolean
} = { olderThanDays: 365 }) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - options.olderThanDays)
  const cutoffISO = cutoffDate.toISOString()

  const cleanupActions = []

  // 古い生成ログを削除
  const oldLogs = await db
    .select({ count: count() })
    .from(generationLogs)
    .where(sql`${generationLogs.createdAt} < ${cutoffISO}`)
    .get()

  if (oldLogs && oldLogs.count > 0) {
    cleanupActions.push({
      action: 'delete_old_generation_logs',
      count: oldLogs.count,
      description: `${options.olderThanDays}日以前の生成ログを削除`
    })

    if (!options.dryRun) {
      await db.delete(generationLogs).where(sql`${generationLogs.createdAt} < ${cutoffISO}`)
    }
  }

  // 古いバージョンの時間割履歴を削除（最新5件は保持）
  const oldHistory = await db
    .select({ 
      timetableId: timetableHistory.timetableId,
      count: count()
    })
    .from(timetableHistory)
    .groupBy(timetableHistory.timetableId)
    .having(sql`count(*) > 5`)

  for (const group of oldHistory) {
    if (group.count > 5) {
      const recordsToDelete = await db
        .select({ id: timetableHistory.id })
        .from(timetableHistory)
        .where(eq(timetableHistory.timetableId, group.timetableId))
        .orderBy(desc(timetableHistory.createdAt))
        .offset(5) // 最新5件をスキップ

      cleanupActions.push({
        action: 'delete_old_timetable_history',
        count: recordsToDelete.length,
        description: `時間割 ${group.timetableId} の古い履歴を削除`
      })

      if (!options.dryRun && recordsToDelete.length > 0) {
        await db.delete(timetableHistory).where(
          sql`${timetableHistory.id} IN (${recordsToDelete.map(r => `'${r.id}'`).join(',')})`
        )
      }
    }
  }

  return {
    totalActions: cleanupActions.length,
    actions: cleanupActions,
    dryRun: options.dryRun ?? false
  }
}

// ユーザーの学校アクセス権限管理
export async function grantSchoolAccess(
  db: DrizzleDb,
  userId: string,
  schoolId: string,
  role: 'admin' | 'editor' | 'viewer' = 'viewer'
) {
  const existing = await db
    .select()
    .from(userSchools)
    .where(and(
      eq(userSchools.userId, userId),
      eq(userSchools.schoolId, schoolId)
    ))
    .get()

  if (existing) {
    // 既存のアクセス権限を更新
    await db
      .update(userSchools)
      .set({ role })
      .where(eq(userSchools.id, existing.id))
  } else {
    // 新規アクセス権限を作成
    await db.insert(userSchools).values({
      userId,
      schoolId,
      role
    })
  }
}

// パフォーマンス分析
export async function analyzePerformance(db: DrizzleDb) {
  const analysis = {
    slowQueries: [],
    largestTables: [],
    indexUsage: [],
    recommendations: []
  }

  // 最大のテーブルサイズを確認（SQLiteの場合）
  try {
    const tableStats = await Promise.all([
      db.select({ count: count() }).from(schedules).get(),
      db.select({ count: count() }).from(generationLogs).get(),
      db.select({ count: count() }).from(timetableHistory).get(),
    ])

    analysis.largestTables = [
      { table: 'schedules', count: tableStats[0]?.count || 0 },
      { table: 'generation_logs', count: tableStats[1]?.count || 0 },
      { table: 'timetable_history', count: tableStats[2]?.count || 0 },
    ].sort((a, b) => b.count - a.count)

    // パフォーマンス推奨事項
    if ((tableStats[1]?.count || 0) > 10000) {
      analysis.recommendations.push('生成ログが多く蓄積されています。定期的なクリーンアップをお勧めします。')
    }

    if ((tableStats[2]?.count || 0) > 1000) {
      analysis.recommendations.push('時間割履歴が多く蓄積されています。古いバージョンの削除をお勧めします。')
    }

  } catch (error) {
    console.error('Performance analysis error:', error)
  }

  return analysis
}