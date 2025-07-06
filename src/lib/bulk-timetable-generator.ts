/**
 * バルク時間割生成メイン処理
 * 複数クラスの統合時間割をGemini APIで生成
 */

import { and, eq, inArray } from 'drizzle-orm'
import type { DrizzleDb } from '../db'
import { schedules, timetables } from '../db/schema'
import {
  generateBulkTimetablePrompt,
  getBulkTimetableGenerationData,
} from './bulk-timetable-prompt'
import { validateTimetableConstraints } from './constraints/manager'
import { generateTimetableWithGemini, validateGeminiApiKey } from './gemini'
import { validateGeneratedTimetable, validateTimetableStructure } from './timetable-validator'
import type { BulkGenerateTimetableInput } from './validation'

interface BulkGenerationResult {
  success: boolean
  data?: {
    timetableId: string
    classIds: string[]
    totalSlotsCreated: number
    slotsPerClass: Record<string, number>
  }
  error?: string
  message?: string
  retryable?: boolean
}

/**
 * バルク時間割生成のメイン処理（単発実行）
 */
export async function generateBulkTimetable(
  db: DrizzleDb,
  timetableId: string,
  input: BulkGenerateTimetableInput,
  geminiApiKey: string
): Promise<BulkGenerationResult> {
  const { classIds, priority } = input

  // API キーの検証
  if (!validateGeminiApiKey(geminiApiKey)) {
    return {
      success: false,
      error: 'INVALID_API_KEY',
      message: 'Gemini API キーが無効です',
    }
  }

  // 時間割データの取得
  const timetableData = await getBulkTimetableGenerationData(db, timetableId, classIds)
  if (!timetableData) {
    return {
      success: false,
      error: 'TIMETABLE_NOT_FOUND',
      message: '時間割データが見つかりません',
    }
  }

  // 指定されたクラスが存在するかチェック
  const foundClassIds = timetableData.classes.map(c => c.id)
  const missingClassIds = classIds.filter(id => !foundClassIds.includes(id))
  if (missingClassIds.length > 0) {
    return {
      success: false,
      error: 'CLASS_NOT_FOUND',
      message: `指定されたクラスが見つかりません: ${missingClassIds.join(', ')}`,
    }
  }

  const schoolId = timetableData.timetable.school.id
  const saturdayHours = timetableData.timetable.saturdayHours

  // 指定クラスの既存スケジュールを削除
  await db
    .delete(schedules)
    .where(and(eq(schedules.timetableId, timetableId), inArray(schedules.classId, classIds)))

  try {
    console.log(`バルク時間割生成開始: ${classIds.length}クラス`)

    // プロンプトの生成
    const prompt = generateBulkTimetablePrompt(timetableData, input)

    // Gemini API での生成
    const geminiResult = await generateTimetableWithGemini(prompt, geminiApiKey, priority)

    if (!geminiResult.success) {
      return {
        success: false,
        error: geminiResult.error || 'GEMINI_API_ERROR',
        message: geminiResult.message,
        retryable: geminiResult.retryable,
      }
    }

    // 生成されたデータの構造検証
    if (!validateTimetableStructure(geminiResult.data)) {
      return {
        success: false,
        error: 'INVALID_STRUCTURE',
        message: '生成されたデータ構造が無効です',
        retryable: true,
      }
    }

    // 各クラスのスケジュールを個別に検証
    const classSchedules = groupSchedulesByClass(geminiResult.data.schedules, classIds)
    const validationErrors: string[] = []

    for (const [classId, classSchedule] of Object.entries(classSchedules)) {
      const classValidationResult = await validateGeneratedTimetable(
        db,
        { timetableId, schedules: classSchedule },
        schoolId,
        saturdayHours
      )

      if (!classValidationResult.isValid) {
        validationErrors.push(`クラス ${classId}: ${classValidationResult.errors.join(', ')}`)
      }
    }

    // 全クラス横断の制約チェック（新しい制約システムを使用）
    const constraintValidation = await validateTimetableConstraints(
      db,
      timetableId,
      geminiResult.data.schedules,
      {
        schoolId,
        saturdayHours,
      }
    )

    if (!constraintValidation.isValid) {
      const errorMessages = constraintValidation.violations
        .filter(v => v.severity === 'error')
        .map(v => v.message)
      validationErrors.push(...errorMessages)
    }

    // 従来の制約チェックも併用（互換性のため）
    const crossClassValidation = validateCrossClassConstraints(geminiResult.data.schedules)
    if (crossClassValidation.errors.length > 0) {
      validationErrors.push(...crossClassValidation.errors)
    }

    if (validationErrors.length > 0) {
      return {
        success: false,
        error: 'VALIDATION_FAILED',
        message: `検証エラー: ${validationErrors.join('; ')}`,
        retryable: true,
      }
    }

    // データベースにスケジュールを保存
    const { totalSlotsCreated, slotsPerClass } = await saveBulkSchedulesToDatabase(
      db,
      geminiResult.data,
      classIds
    )

    return {
      success: true,
      data: {
        timetableId,
        classIds,
        totalSlotsCreated,
        slotsPerClass,
      },
    }
  } catch (error) {
    console.error('バルク時間割生成エラー:', error)

    return {
      success: false,
      error: 'UNEXPECTED_ERROR',
      message: '予期しないエラーが発生しました',
      retryable: true,
    }
  }
}

/**
 * スケジュールをクラス別にグループ化
 */
function groupSchedulesByClass(schedules: any[], classIds: string[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {}

  // 全クラスIDで初期化
  for (const classId of classIds) {
    grouped[classId] = []
  }

  // スケジュールをクラス別に分類
  for (const schedule of schedules) {
    if (schedule.classId && classIds.includes(schedule.classId)) {
      grouped[schedule.classId].push(schedule)
    }
  }

  return grouped
}

/**
 * クラス横断制約の検証（教師・教室の重複チェック）
 */
function validateCrossClassConstraints(schedules: any[]): { errors: string[] } {
  const errors: string[] = []
  const teacherSlots = new Map<string, Set<string>>()
  const classroomSlots = new Map<string, Set<string>>()

  for (const schedule of schedules) {
    const timeKey = `${schedule.dayOfWeek}-${schedule.period}`

    // 教師の重複チェック
    if (!teacherSlots.has(schedule.teacherId)) {
      teacherSlots.set(schedule.teacherId, new Set())
    }

    if (teacherSlots.get(schedule.teacherId)!.has(timeKey)) {
      errors.push(
        `教師重複: ${schedule.teacherId} が ${schedule.dayOfWeek}曜日 ${schedule.period}時限に複数クラスに配置されています`
      )
    }
    teacherSlots.get(schedule.teacherId)!.add(timeKey)

    // 教室の重複チェック
    if (!classroomSlots.has(schedule.classroomId)) {
      classroomSlots.set(schedule.classroomId, new Set())
    }

    if (classroomSlots.get(schedule.classroomId)!.has(timeKey)) {
      errors.push(
        `教室重複: ${schedule.classroomId} が ${schedule.dayOfWeek}曜日 ${schedule.period}時限に複数クラスで使用されています`
      )
    }
    classroomSlots.get(schedule.classroomId)!.add(timeKey)
  }

  return { errors }
}

/**
 * バルク生成されたスケジュールをデータベースに保存
 */
async function saveBulkSchedulesToDatabase(
  db: DrizzleDb,
  timetableData: any,
  classIds: string[]
): Promise<{ totalSlotsCreated: number; slotsPerClass: Record<string, number> }> {
  const { timetableId, schedules: generatedSchedules } = timetableData

  if (!generatedSchedules || generatedSchedules.length === 0) {
    return {
      totalSlotsCreated: 0,
      slotsPerClass: Object.fromEntries(classIds.map(id => [id, 0])),
    }
  }

  // 指定クラスのスケジュールのみフィルタ
  const validSchedules = generatedSchedules.filter((schedule: any) =>
    classIds.includes(schedule.classId)
  )

  // バッチでスケジュールを挿入
  const scheduleInserts = validSchedules.map((schedule: any) => ({
    timetableId,
    classId: schedule.classId,
    subjectId: schedule.subjectId,
    teacherId: schedule.teacherId,
    classroomId: schedule.classroomId,
    dayOfWeek: schedule.dayOfWeek,
    period: schedule.period,
  }))

  if (scheduleInserts.length > 0) {
    await db.insert(schedules).values(scheduleInserts)
  }

  // クラス別スロット数を計算
  const slotsPerClass: Record<string, number> = {}
  for (const classId of classIds) {
    slotsPerClass[classId] = scheduleInserts.filter((s: any) => s.classId === classId).length
  }

  return {
    totalSlotsCreated: scheduleInserts.length,
    slotsPerClass,
  }
}
