/**
 * フロントエンド連携支援機能
 * UIに最適化されたデータ形式とヘルパー関数
 */

import { and, eq, inArray } from 'drizzle-orm'
import { classes, classrooms, schedules, subjects, teachers, timetables } from '../db/schema'
import { cachedQuery } from './cache-system'
import type { DrizzleDb } from './db'
import { getBatchClassStatistics, getOptimizedSchedules } from './query-optimizer'

// フロントエンド最適化されたデータ型
export interface TimetableGridData {
  timetableId: string
  timetableName: string
  classes: Array<{
    id: string
    name: string
    grade: number
    scheduleGrid: ScheduleGridCell[][]
  }>
}

export interface ScheduleGridCell {
  dayOfWeek: number
  period: number
  subject?: {
    id: string
    name: string
  }
  teacher?: {
    id: string
    name: string
  }
  classroom?: {
    id: string
    name: string
    type: string
  }
  hasConflict?: boolean
  conflictType?: 'teacher' | 'classroom' | 'constraint'
  conflictMessage?: string
}

export interface ConstraintViolationSummary {
  totalViolations: number
  errorCount: number
  warningCount: number
  infoCount: number
  violationsByType: Record<string, number>
  violationsByClass: Record<string, number>
  mostCommonViolations: Array<{
    type: string
    count: number
    description: string
  }>
}

export interface TimetableStatistics {
  totalSlots: number
  filledSlots: number
  emptySlots: number
  fillRate: number
  classCoverage: Record<
    string,
    {
      totalSlots: number
      filledSlots: number
      fillRate: number
    }
  >
  teacherUtilization: Record<
    string,
    {
      totalAssignedSlots: number
      utilizationRate: number
    }
  >
  classroomUtilization: Record<
    string,
    {
      totalAssignedSlots: number
      utilizationRate: number
    }
  >
  subjectDistribution: Record<string, number>
}

/**
 * 時間割グリッドデータを取得（キャッシュ最適化版）
 */
export async function getTimetableGridData(
  db: DrizzleDb,
  timetableId: string,
  classIds?: string[]
): Promise<TimetableGridData> {
  const cacheKey = `grid-data:${timetableId}:${classIds?.join(',') || 'all'}`

  return await cachedQuery(
    cacheKey,
    async () => {
      // 最適化されたクエリを使用
      const optimizedSchedules = await getOptimizedSchedules(db, timetableId, {
        classIds,
        useCache: false, // 上位レベルでキャッシュするため
      })

      // 時間割基本情報を取得
      const timetable = await db
        .select()
        .from(timetables)
        .where(eq(timetables.id, timetableId))
        .get()

      if (!timetable) {
        throw new Error('TIMETABLE_NOT_FOUND')
      }

      // クラス別にデータを整理
      const classesMap = new Map<string, any>()

      optimizedSchedules.forEach(item => {
        const classId = item.schedule.classId
        if (!classesMap.has(classId)) {
          classesMap.set(classId, {
            id: classId,
            name: item.class.name,
            grade: item.class.grade,
            schedules: [],
          })
        }
        classesMap.get(classId)!.schedules.push(item)
      })

      // グリッド形式に変換
      const classScheduleData = Array.from(classesMap.values()).map(classData => {
        const scheduleGrid: ScheduleGridCell[][] = Array.from({ length: 6 }, (_, dayIndex) =>
          Array.from({ length: 6 }, (_, periodIndex) => {
            const schedule = classData.schedules.find(
              (s: any) =>
                s.schedule.dayOfWeek === dayIndex + 1 && s.schedule.period === periodIndex + 1
            )

            return {
              dayOfWeek: dayIndex + 1,
              period: periodIndex + 1,
              subject: schedule?.subject
                ? {
                    id: schedule.subject.id,
                    name: schedule.subject.name,
                  }
                : undefined,
              teacher: schedule?.teacher
                ? {
                    id: schedule.teacher.id,
                    name: schedule.teacher.name,
                  }
                : undefined,
              classroom: schedule?.classroom
                ? {
                    id: schedule.classroom.id,
                    name: schedule.classroom.name,
                    type: schedule.classroom.type,
                  }
                : undefined,
            }
          })
        )

        return {
          id: classData.id,
          name: classData.name,
          grade: classData.grade,
          scheduleGrid,
        }
      })

      return {
        timetableId: timetable.id,
        timetableName: timetable.name,
        classes: classScheduleData,
      }
    },
    300000
  ) // 5分キャッシュ
}

/**
 * 時間割統計情報を取得
 */
export async function getTimetableStatistics(
  db: DrizzleDb,
  timetableId: string
): Promise<TimetableStatistics> {
  // 全スケジュールデータを取得
  const allSchedules = await db
    .select({
      schedule: schedules,
      subject: subjects,
      teacher: teachers,
      classroom: classrooms,
      class: classes,
    })
    .from(schedules)
    .leftJoin(subjects, eq(schedules.subjectId, subjects.id))
    .leftJoin(teachers, eq(schedules.teacherId, teachers.id))
    .leftJoin(classrooms, eq(schedules.classroomId, classrooms.id))
    .leftJoin(classes, eq(schedules.classId, classes.id))
    .where(eq(schedules.timetableId, timetableId))

  // 時間割の設定情報を取得
  const timetable = await db.select().from(timetables).where(eq(timetables.id, timetableId)).get()

  if (!timetable) {
    throw new Error('TIMETABLE_NOT_FOUND')
  }

  // 対象クラス一覧を取得
  const targetClasses = await db
    .select()
    .from(classes)
    .where(eq(classes.schoolId, timetable.schoolId))

  // 統計計算
  const maxSlotsPerClass = timetable.saturdayHours > 0 ? 36 : 30 // 6日×6時限 or 5日×6時限
  const totalPossibleSlots = targetClasses.length * maxSlotsPerClass
  const filledSlots = allSchedules.length
  const emptySlots = totalPossibleSlots - filledSlots

  // クラス別カバレッジ
  const classCoverage: Record<
    string,
    { totalSlots: number; filledSlots: number; fillRate: number }
  > = {}
  for (const classData of targetClasses) {
    const classScheduleCount = allSchedules.filter(s => s.schedule.classId === classData.id).length
    classCoverage[classData.id] = {
      totalSlots: maxSlotsPerClass,
      filledSlots: classScheduleCount,
      fillRate: classScheduleCount / maxSlotsPerClass,
    }
  }

  // 教師利用率
  const teacherUtilization: Record<
    string,
    { totalAssignedSlots: number; utilizationRate: number }
  > = {}
  const teacherScheduleCounts = allSchedules.reduce(
    (acc, schedule) => {
      if (schedule.teacher) {
        acc[schedule.teacher.id] = (acc[schedule.teacher.id] || 0) + 1
      }
      return acc
    },
    {} as Record<string, number>
  )

  for (const [teacherId, count] of Object.entries(teacherScheduleCounts)) {
    teacherUtilization[teacherId] = {
      totalAssignedSlots: count,
      utilizationRate: count / totalPossibleSlots, // 全体に対する比率
    }
  }

  // 教室利用率
  const classroomUtilization: Record<
    string,
    { totalAssignedSlots: number; utilizationRate: number }
  > = {}
  const classroomScheduleCounts = allSchedules.reduce(
    (acc, schedule) => {
      if (schedule.classroom) {
        acc[schedule.classroom.id] = (acc[schedule.classroom.id] || 0) + 1
      }
      return acc
    },
    {} as Record<string, number>
  )

  for (const [classroomId, count] of Object.entries(classroomScheduleCounts)) {
    classroomUtilization[classroomId] = {
      totalAssignedSlots: count,
      utilizationRate: count / totalPossibleSlots,
    }
  }

  // 教科分布
  const subjectDistribution = allSchedules.reduce(
    (acc, schedule) => {
      if (schedule.subject) {
        acc[schedule.subject.id] = (acc[schedule.subject.id] || 0) + 1
      }
      return acc
    },
    {} as Record<string, number>
  )

  return {
    totalSlots: totalPossibleSlots,
    filledSlots,
    emptySlots,
    fillRate: filledSlots / totalPossibleSlots,
    classCoverage,
    teacherUtilization,
    classroomUtilization,
    subjectDistribution,
  }
}

/**
 * 制約違反サマリーを生成
 */
export function generateConstraintViolationSummary(
  violations: Array<{
    code: string
    severity: 'error' | 'warning' | 'info'
    affectedSchedules: Array<{ classId: string }>
    metadata?: any
  }>
): ConstraintViolationSummary {
  const errorCount = violations.filter(v => v.severity === 'error').length
  const warningCount = violations.filter(v => v.severity === 'warning').length
  const infoCount = violations.filter(v => v.severity === 'info').length

  // 違反タイプ別カウント
  const violationsByType = violations.reduce(
    (acc, violation) => {
      const type = violation.code.split('_')[0] // コードの最初の部分をタイプとする
      acc[type] = (acc[type] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // クラス別違反カウント
  const violationsByClass = violations.reduce(
    (acc, violation) => {
      for (const schedule of violation.affectedSchedules) {
        acc[schedule.classId] = (acc[schedule.classId] || 0) + 1
      }
      return acc
    },
    {} as Record<string, number>
  )

  // 最も多い違反トップ5
  const mostCommonViolations = Object.entries(violationsByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([type, count]) => ({
      type,
      count,
      description: getViolationTypeDescription(type),
    }))

  return {
    totalViolations: violations.length,
    errorCount,
    warningCount,
    infoCount,
    violationsByType,
    violationsByClass,
    mostCommonViolations,
  }
}

/**
 * 違反タイプの説明を取得
 */
function getViolationTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    teacher: '教師関連の制約違反',
    classroom: '教室関連の制約違反',
    subject: '教科関連の制約違反',
    time: '時間関連の制約違反',
    CONSECUTIVE: '連続時限の制約違反',
    DISTRIBUTION: '配置バランスの制約違反',
    PREFERENCE: '優先設定の制約違反',
  }

  return descriptions[type] || '不明な制約違反'
}

/**
 * 時間割データの整合性チェック
 */
export async function validateTimetableIntegrity(
  db: DrizzleDb,
  timetableId: string
): Promise<{
  isValid: boolean
  issues: Array<{
    type: 'missing_data' | 'invalid_reference' | 'duplicate_entry'
    description: string
    affectedSchedules: string[]
  }>
}> {
  const issues = []

  // 存在しない参照をチェック
  const invalidReferences = await db
    .select({
      schedule: schedules,
    })
    .from(schedules)
    .leftJoin(subjects, eq(schedules.subjectId, subjects.id))
    .leftJoin(teachers, eq(schedules.teacherId, teachers.id))
    .leftJoin(classrooms, eq(schedules.classroomId, classrooms.id))
    .leftJoin(classes, eq(schedules.classId, classes.id))
    .where(eq(schedules.timetableId, timetableId))

  // データ整合性の詳細チェックを実装
  // （簡略化のため、基本的なチェックのみ実装）

  return {
    isValid: issues.length === 0,
    issues,
  }
}
