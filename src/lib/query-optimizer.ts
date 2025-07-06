/**
 * データベースクエリ最適化
 * バッチ処理、効率的なJOIN、インデックス活用
 */

import type { DrizzleDb } from './db'
import { eq, inArray, and, or, desc, asc, count, sql } from 'drizzle-orm'
import { 
  schools, classes, teachers, subjects, classrooms,
  timetables, schedules, teacherSubjects, classroomSubjects,
  constraintConfigurations, generationLogs
} from '../db/schema'
import { cachedQuery } from './cache-system'

/**
 * 最適化されたスケジュール取得（JOINを使用）
 */
export async function getOptimizedSchedules(
  db: DrizzleDb,
  timetableId: string,
  options: {
    classIds?: string[]
    useCache?: boolean
    cacheTTL?: number
  } = {}
): Promise<Array<{
  schedule: any
  class: any
  teacher: any
  subject: any
  classroom: any
}>> {
  const { classIds, useCache = true, cacheTTL = 300000 } = options
  
  const queryFn = async () => {
    let query = db
      .select({
        schedule: schedules,
        class: {
          id: classes.id,
          name: classes.name,
          grade: classes.grade,
          section: classes.section
        },
        teacher: {
          id: teachers.id,
          name: teachers.name,
          employmentType: teachers.employmentType
        },
        subject: {
          id: subjects.id,
          name: subjects.name,
          shortName: subjects.shortName,
          color: subjects.color
        },
        classroom: {
          id: classrooms.id,
          name: classrooms.name,
          type: classrooms.type,
          building: classrooms.building,
          floor: classrooms.floor
        }
      })
      .from(schedules)
      .innerJoin(classes, eq(schedules.classId, classes.id))
      .innerJoin(teachers, eq(schedules.teacherId, teachers.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .where(eq(schedules.timetableId, timetableId))

    if (classIds && classIds.length > 0) {
      query = query.where(and(
        eq(schedules.timetableId, timetableId),
        inArray(schedules.classId, classIds)
      ))
    }

    return await query.orderBy(
      asc(schedules.dayOfWeek),
      asc(schedules.period),
      asc(classes.grade),
      asc(classes.name)
    )
  }

  if (useCache) {
    const cacheKey = `schedules:${timetableId}:${classIds?.join(',') || 'all'}`
    return await cachedQuery(cacheKey, queryFn, cacheTTL)
  }

  return await queryFn()
}

/**
 * バッチ処理による複数クラスの統計取得
 */
export async function getBatchClassStatistics(
  db: DrizzleDb,
  timetableId: string,
  classIds: string[]
): Promise<Record<string, {
  totalSlots: number
  filledSlots: number
  fillRate: number
  subjectDistribution: Record<string, number>
  teacherHours: Record<string, number>
}>> {
  // 単一クエリで全クラスの統計を取得
  const scheduleStats = await db
    .select({
      classId: schedules.classId,
      subjectId: schedules.subjectId,
      subjectName: subjects.name,
      teacherId: schedules.teacherId,
      teacherName: teachers.name,
      scheduleCount: count()
    })
    .from(schedules)
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(teachers, eq(schedules.teacherId, teachers.id))
    .where(and(
      eq(schedules.timetableId, timetableId),
      inArray(schedules.classId, classIds)
    ))
    .groupBy(
      schedules.classId,
      schedules.subjectId,
      schedules.teacherId,
      subjects.name,
      teachers.name
    )

  // 時間割設定取得
  const timetable = await db
    .select({ saturdayHours: timetables.saturdayHours })
    .from(timetables)
    .where(eq(timetables.id, timetableId))
    .get()

  const maxSlotsPerClass = timetable?.saturdayHours && timetable.saturdayHours > 0 ? 36 : 30

  // クラス別に統計を集計
  const results: Record<string, any> = {}
  
  for (const classId of classIds) {
    const classSchedules = scheduleStats.filter(s => s.classId === classId)
    const filledSlots = classSchedules.reduce((sum, s) => sum + s.scheduleCount, 0)
    
    // 教科分布
    const subjectDistribution: Record<string, number> = {}
    classSchedules.forEach(s => {
      subjectDistribution[s.subjectName] = (subjectDistribution[s.subjectName] || 0) + s.scheduleCount
    })

    // 教師担当時間数
    const teacherHours: Record<string, number> = {}
    classSchedules.forEach(s => {
      teacherHours[s.teacherName] = (teacherHours[s.teacherName] || 0) + s.scheduleCount
    })

    results[classId] = {
      totalSlots: maxSlotsPerClass,
      filledSlots,
      fillRate: filledSlots / maxSlotsPerClass,
      subjectDistribution,
      teacherHours
    }
  }

  return results
}

/**
 * 効率的な制約設定取得（学校別）
 */
export async function getSchoolConstraints(
  db: DrizzleDb,
  schoolId: string,
  useCache: boolean = true
): Promise<Record<string, {
  isEnabled: boolean
  priority: number
  parameters: Record<string, any>
}>> {
  const queryFn = async () => {
    const constraints = await db
      .select()
      .from(constraintConfigurations)
      .where(eq(constraintConfigurations.schoolId, schoolId))
      .orderBy(desc(constraintConfigurations.priority))

    const result: Record<string, any> = {}
    constraints.forEach(constraint => {
      result[constraint.constraintType] = {
        isEnabled: constraint.isEnabled,
        priority: constraint.priority,
        parameters: constraint.parameters || {}
      }
    })

    return result
  }

  if (useCache) {
    const cacheKey = `school-constraints:${schoolId}`
    return await cachedQuery(cacheKey, queryFn, 600000) // 10分キャッシュ
  }

  return await queryFn()
}

/**
 * 教師の担当可能教科と優先度を効率的に取得
 */
export async function getTeacherSubjectMapping(
  db: DrizzleDb,
  schoolId: string,
  useCache: boolean = true
): Promise<Record<string, Array<{
  subjectId: string
  subjectName: string
  qualificationLevel: string
  priority: number
}>>> {
  const queryFn = async () => {
    const mapping = await db
      .select({
        teacherId: teachers.id,
        teacherName: teachers.name,
        subjectId: subjects.id,
        subjectName: subjects.name,
        qualificationLevel: teacherSubjects.qualificationLevel,
        priority: teacherSubjects.priority
      })
      .from(teachers)
      .innerJoin(teacherSubjects, eq(teachers.id, teacherSubjects.teacherId))
      .innerJoin(subjects, eq(teacherSubjects.subjectId, subjects.id))
      .where(and(
        eq(teachers.schoolId, schoolId),
        eq(teachers.isActive, true),
        eq(subjects.isActive, true)
      ))
      .orderBy(asc(teacherSubjects.priority))

    const result: Record<string, any> = {}
    mapping.forEach(item => {
      if (!result[item.teacherId]) {
        result[item.teacherId] = []
      }
      result[item.teacherId].push({
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        qualificationLevel: item.qualificationLevel || 'qualified',
        priority: item.priority || 1
      })
    })

    return result
  }

  if (useCache) {
    const cacheKey = `teacher-subjects:${schoolId}`
    return await cachedQuery(cacheKey, queryFn, 1800000) // 30分キャッシュ
  }

  return await queryFn()
}

/**
 * 教室と教科の専用関係を効率的に取得
 */
export async function getClassroomSubjectMapping(
  db: DrizzleDb,
  schoolId: string,
  useCache: boolean = true
): Promise<Record<string, Array<{
  classroomId: string
  classroomName: string
  classroomType: string
  preferredSubjects: string[]
}>>> {
  const queryFn = async () => {
    const mapping = await db
      .select({
        subjectId: subjects.id,
        subjectName: subjects.name,
        classroomId: classrooms.id,
        classroomName: classrooms.name,
        classroomType: classrooms.type,
        building: classrooms.building,
        floor: classrooms.floor
      })
      .from(subjects)
      .leftJoin(classroomSubjects, eq(subjects.id, classroomSubjects.subjectId))
      .leftJoin(classrooms, eq(classroomSubjects.classroomId, classrooms.id))
      .where(and(
        eq(subjects.schoolId, schoolId),
        eq(subjects.isActive, true)
      ))

    const result: Record<string, any> = {}
    
    mapping.forEach(item => {
      if (!result[item.subjectId]) {
        result[item.subjectId] = []
      }
      
      if (item.classroomId) {
        result[item.subjectId].push({
          classroomId: item.classroomId,
          classroomName: item.classroomName,
          classroomType: item.classroomType,
          preferredSubjects: [] // 逆引き用（後で設定）
        })
      }
    })

    return result
  }

  if (useCache) {
    const cacheKey = `classroom-subjects:${schoolId}`
    return await cachedQuery(cacheKey, queryFn, 1800000) // 30分キャッシュ
  }

  return await queryFn()
}

/**
 * 競合検出クエリ最適化（教師・教室の時間重複）
 */
export async function detectConflictsOptimized(
  db: DrizzleDb,
  timetableId: string,
  targetSchedules: Array<{
    classId: string
    teacherId: string
    classroomId: string
    dayOfWeek: number
    period: number
  }>
): Promise<{
  teacherConflicts: Array<{
    teacherId: string
    teacherName: string
    dayOfWeek: number
    period: number
    conflictingClasses: Array<{ classId: string; className: string }>
  }>
  classroomConflicts: Array<{
    classroomId: string
    classroomName: string
    dayOfWeek: number
    period: number
    conflictingClasses: Array<{ classId: string; className: string }>
  }>
}> {
  // 効率的な競合検出のため、単一クエリで全ての関連データを取得
  const timeSlots = Array.from(new Set(
    targetSchedules.map(s => `${s.dayOfWeek}-${s.period}`)
  ))

  const existingSchedules = await db
    .select({
      schedule: schedules,
      teacher: { id: teachers.id, name: teachers.name },
      classroom: { id: classrooms.id, name: classrooms.name },
      class: { id: classes.id, name: classes.name }
    })
    .from(schedules)
    .innerJoin(teachers, eq(schedules.teacherId, teachers.id))
    .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .where(and(
      eq(schedules.timetableId, timetableId),
      or(
        ...timeSlots.map(slot => {
          const [dayOfWeek, period] = slot.split('-').map(Number)
          return and(
            eq(schedules.dayOfWeek, dayOfWeek),
            eq(schedules.period, period)
          )
        })
      )
    ))

  // 競合分析
  const teacherConflicts: any[] = []
  const classroomConflicts: any[] = []

  // 教師競合検出
  const teacherSlots = new Map<string, any[]>()
  existingSchedules.forEach(item => {
    const key = `${item.schedule.teacherId}-${item.schedule.dayOfWeek}-${item.schedule.period}`
    if (!teacherSlots.has(key)) {
      teacherSlots.set(key, [])
    }
    teacherSlots.get(key)!.push(item)
  })

  // 新しいスケジュールとの競合をチェック
  targetSchedules.forEach(newSchedule => {
    const key = `${newSchedule.teacherId}-${newSchedule.dayOfWeek}-${newSchedule.period}`
    const existing = teacherSlots.get(key)
    
    if (existing && existing.length > 0) {
      const teacherName = existing[0].teacher.name
      teacherConflicts.push({
        teacherId: newSchedule.teacherId,
        teacherName,
        dayOfWeek: newSchedule.dayOfWeek,
        period: newSchedule.period,
        conflictingClasses: existing.map(e => ({
          classId: e.class.id,
          className: e.class.name
        }))
      })
    }
  })

  // 教室競合検出（同様の処理）
  const classroomSlots = new Map<string, any[]>()
  existingSchedules.forEach(item => {
    const key = `${item.schedule.classroomId}-${item.schedule.dayOfWeek}-${item.schedule.period}`
    if (!classroomSlots.has(key)) {
      classroomSlots.set(key, [])
    }
    classroomSlots.get(key)!.push(item)
  })

  targetSchedules.forEach(newSchedule => {
    const key = `${newSchedule.classroomId}-${newSchedule.dayOfWeek}-${newSchedule.period}`
    const existing = classroomSlots.get(key)
    
    if (existing && existing.length > 0) {
      const classroomName = existing[0].classroom.name
      classroomConflicts.push({
        classroomId: newSchedule.classroomId,
        classroomName,
        dayOfWeek: newSchedule.dayOfWeek,
        period: newSchedule.period,
        conflictingClasses: existing.map(e => ({
          classId: e.class.id,
          className: e.class.name
        }))
      })
    }
  })

  return { teacherConflicts, classroomConflicts }
}

/**
 * 一括スケジュール挿入の最適化
 */
export async function bulkInsertSchedules(
  db: DrizzleDb,
  scheduleData: Array<{
    timetableId: string
    classId: string
    teacherId: string
    subjectId: string
    classroomId: string
    dayOfWeek: number
    period: number
    weekType?: string
    generatedBy?: string
  }>,
  batchSize: number = 50
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = []
  let inserted = 0

  // バッチ処理で挿入
  for (let i = 0; i < scheduleData.length; i += batchSize) {
    const batch = scheduleData.slice(i, i + batchSize)
    
    try {
      await db.insert(schedules).values(batch)
      inserted += batch.length
    } catch (error: any) {
      errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`)
    }
  }

  return { inserted, errors }
}

/**
 * パフォーマンス分析用クエリ実行時間計測
 */
export async function measureQueryPerformance<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const startTime = Date.now()
  
  try {
    const result = await queryFn()
    const duration = Date.now() - startTime
    
    console.log(`Query performance: ${queryName} took ${duration}ms`)
    
    return { result, duration }
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`Query error: ${queryName} failed after ${duration}ms:`, error)
    throw error
  }
}