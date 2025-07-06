/**
 * リアルタイム制約検証システム
 * フロントエンドでの即座な制約チェック用
 */

import { getConstraintManager, validateTimetableConstraints } from './constraints/manager'
import type { DrizzleDb } from './db'

// 軽量制約検証用の型定義
export interface QuickScheduleData {
  classId: string
  subjectId: string
  teacherId: string
  classroomId: string
  dayOfWeek: number
  period: number
}

export interface QuickValidationResult {
  isValid: boolean
  violations: Array<{
    type: 'conflict' | 'warning' | 'info'
    message: string
    affectedCells: Array<{
      classId: string
      dayOfWeek: number
      period: number
    }>
  }>
  executionTime: number
}

/**
 * 軽量・高速制約検証
 * フロントエンドのリアルタイム検証用
 */
export async function quickValidation(
  schedules: QuickScheduleData[],
  options: {
    checkTypes?: ('teacher_conflict' | 'classroom_conflict' | 'basic_validation')[]
    maxExecutionTime?: number // ミリ秒
  } = {}
): Promise<QuickValidationResult> {
  const startTime = Date.now()
  const { checkTypes = ['teacher_conflict', 'classroom_conflict'], maxExecutionTime = 100 } =
    options

  const violations = []

  try {
    // 基本的な衝突チェック（データベースアクセスなし）
    if (checkTypes.includes('teacher_conflict')) {
      const teacherConflicts = findTeacherConflicts(schedules)
      violations.push(...teacherConflicts)
    }

    if (checkTypes.includes('classroom_conflict')) {
      const classroomConflicts = findClassroomConflicts(schedules)
      violations.push(...classroomConflicts)
    }

    if (checkTypes.includes('basic_validation')) {
      const basicViolations = validateBasicRules(schedules)
      violations.push(...basicViolations)
    }

    const executionTime = Date.now() - startTime

    // 実行時間制限チェック
    if (executionTime > maxExecutionTime) {
      console.warn(`Quick validation exceeded time limit: ${executionTime}ms`)
    }

    return {
      isValid: violations.filter(v => v.type === 'conflict').length === 0,
      violations,
      executionTime,
    }
  } catch (error) {
    console.error('Quick validation error:', error)
    return {
      isValid: false,
      violations: [
        {
          type: 'conflict',
          message: '検証処理でエラーが発生しました',
          affectedCells: [],
        },
      ],
      executionTime: Date.now() - startTime,
    }
  }
}

/**
 * 教師の時間重複を検出
 */
function findTeacherConflicts(schedules: QuickScheduleData[]) {
  const violations = []
  const teacherSlots = new Map<string, Map<string, QuickScheduleData[]>>()

  // 教師別・時間別にスケジュールをグループ化
  for (const schedule of schedules) {
    const teacherId = schedule.teacherId
    const timeSlot = `${schedule.dayOfWeek}-${schedule.period}`

    if (!teacherSlots.has(teacherId)) {
      teacherSlots.set(teacherId, new Map())
    }

    const teacherTimeSlots = teacherSlots.get(teacherId)!
    if (!teacherTimeSlots.has(timeSlot)) {
      teacherTimeSlots.set(timeSlot, [])
    }

    teacherTimeSlots.get(timeSlot)!.push(schedule)
  }

  // 重複を検出
  for (const [teacherId, timeSlots] of teacherSlots) {
    for (const [timeSlot, conflictingSchedules] of timeSlots) {
      if (conflictingSchedules.length > 1) {
        const [dayOfWeek, period] = timeSlot.split('-').map(Number)
        violations.push({
          type: 'conflict' as const,
          message: `教師が ${dayOfWeek}曜日 ${period}時限に複数のクラス（${conflictingSchedules.map(s => s.classId).join('、')}）を担当しています`,
          affectedCells: conflictingSchedules.map(s => ({
            classId: s.classId,
            dayOfWeek: s.dayOfWeek,
            period: s.period,
          })),
        })
      }
    }
  }

  return violations
}

/**
 * 教室の時間重複を検出
 */
function findClassroomConflicts(schedules: QuickScheduleData[]) {
  const violations = []
  const classroomSlots = new Map<string, Map<string, QuickScheduleData[]>>()

  // 教室別・時間別にスケジュールをグループ化
  for (const schedule of schedules) {
    const classroomId = schedule.classroomId
    const timeSlot = `${schedule.dayOfWeek}-${schedule.period}`

    if (!classroomSlots.has(classroomId)) {
      classroomSlots.set(classroomId, new Map())
    }

    const classroomTimeSlots = classroomSlots.get(classroomId)!
    if (!classroomTimeSlots.has(timeSlot)) {
      classroomTimeSlots.set(timeSlot, [])
    }

    classroomTimeSlots.get(timeSlot)!.push(schedule)
  }

  // 重複を検出
  for (const [classroomId, timeSlots] of classroomSlots) {
    for (const [timeSlot, conflictingSchedules] of timeSlots) {
      if (conflictingSchedules.length > 1) {
        const [dayOfWeek, period] = timeSlot.split('-').map(Number)
        violations.push({
          type: 'conflict' as const,
          message: `教室が ${dayOfWeek}曜日 ${period}時限に複数のクラス（${conflictingSchedules.map(s => s.classId).join('、')}）で使用されています`,
          affectedCells: conflictingSchedules.map(s => ({
            classId: s.classId,
            dayOfWeek: s.dayOfWeek,
            period: s.period,
          })),
        })
      }
    }
  }

  return violations
}

/**
 * 基本的なバリデーションルール
 */
function validateBasicRules(schedules: QuickScheduleData[]) {
  const violations = []

  for (const schedule of schedules) {
    // 曜日の範囲チェック
    if (schedule.dayOfWeek < 1 || schedule.dayOfWeek > 6) {
      violations.push({
        type: 'warning' as const,
        message: `無効な曜日です: ${schedule.dayOfWeek}`,
        affectedCells: [
          {
            classId: schedule.classId,
            dayOfWeek: schedule.dayOfWeek,
            period: schedule.period,
          },
        ],
      })
    }

    // 時限の範囲チェック
    if (schedule.period < 1 || schedule.period > 6) {
      violations.push({
        type: 'warning' as const,
        message: `無効な時限です: ${schedule.period}`,
        affectedCells: [
          {
            classId: schedule.classId,
            dayOfWeek: schedule.dayOfWeek,
            period: schedule.period,
          },
        ],
      })
    }

    // 必須フィールドチェック
    if (!schedule.classId || !schedule.subjectId || !schedule.teacherId || !schedule.classroomId) {
      violations.push({
        type: 'warning' as const,
        message: '必須フィールドが不足しています',
        affectedCells: [
          {
            classId: schedule.classId,
            dayOfWeek: schedule.dayOfWeek,
            period: schedule.period,
          },
        ],
      })
    }
  }

  return violations
}

/**
 * 部分的制約検証（DBアクセス有り）
 */
export async function partialValidation(
  db: DrizzleDb,
  timetableId: string,
  schedules: QuickScheduleData[],
  options: {
    constraints?: string[]
    schoolId?: string
  } = {}
): Promise<QuickValidationResult> {
  const startTime = Date.now()

  try {
    // まず軽量検証を実行
    const quickResult = await quickValidation(schedules, {
      checkTypes: ['teacher_conflict', 'classroom_conflict', 'basic_validation'],
    })

    // 重大な競合がある場合は、詳細検証をスキップ
    if (quickResult.violations.filter(v => v.type === 'conflict').length > 0) {
      return quickResult
    }

    // 詳細制約検証（制限付き）
    const constraintResult = await validateTimetableConstraints(db, timetableId, schedules, {
      schoolId: options.schoolId || 'partial-validation',
      saturdayHours: 0,
      enabledConstraints: options.constraints || ['teacher_conflict', 'classroom_conflict'],
    })

    const detailedViolations = constraintResult.violations.map(v => ({
      type:
        v.severity === 'error'
          ? ('conflict' as const)
          : v.severity === 'warning'
            ? ('warning' as const)
            : ('info' as const),
      message: v.message,
      affectedCells: v.affectedSchedules.map(s => ({
        classId: s.classId,
        dayOfWeek: s.dayOfWeek,
        period: s.period,
      })),
    }))

    return {
      isValid: constraintResult.isValid,
      violations: [...quickResult.violations, ...detailedViolations],
      executionTime: Date.now() - startTime,
    }
  } catch (error) {
    console.error('Partial validation error:', error)

    // エラー時は軽量検証の結果を返す
    const quickResult = await quickValidation(schedules)
    return {
      ...quickResult,
      violations: [
        ...quickResult.violations,
        {
          type: 'warning',
          message: '詳細検証でエラーが発生しました。基本チェックのみ実行されています。',
          affectedCells: [],
        },
      ],
    }
  }
}

/**
 * 制約違反のサマリー生成（軽量版）
 */
export function generateQuickSummary(violations: QuickValidationResult['violations']) {
  const conflictCount = violations.filter(v => v.type === 'conflict').length
  const warningCount = violations.filter(v => v.type === 'warning').length
  const infoCount = violations.filter(v => v.type === 'info').length

  return {
    totalViolations: violations.length,
    conflictCount,
    warningCount,
    infoCount,
    hasBlockingIssues: conflictCount > 0,
    severity: conflictCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'info',
  }
}
