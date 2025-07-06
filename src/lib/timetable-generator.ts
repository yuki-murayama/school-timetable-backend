/**
 * 時間割生成メイン処理
 * Gemini APIを使用した時間割生成とリトライ機能
 */

import { eq } from 'drizzle-orm'
import type { DrizzleDb } from '../db'
import { schedules, timetables } from '../db/schema'
import { generateTimetableWithGemini, validateGeminiApiKey } from './gemini'
import { generateTimetablePrompt, getTimetableGenerationData } from './timetable-prompt'
import { validateGeneratedTimetable, validateTimetableStructure } from './timetable-validator'

interface GenerationResult {
  success: boolean
  data?: {
    timetableId: string
    slotsCreated: number
  }
  error?: string
  message?: string
  retryable?: boolean
}

/**
 * 時間割生成のメイン処理（単発実行）
 * フロントエンド側でリトライ制御を行うため、1回のみ実行
 */
export async function generateTimetable(
  db: DrizzleDb,
  timetableId: string,
  requirements: string | undefined,
  priority: 'speed' | 'quality' | 'balanced',
  geminiApiKey: string
): Promise<GenerationResult> {
  // API キーの検証
  if (!validateGeminiApiKey(geminiApiKey)) {
    return {
      success: false,
      error: 'INVALID_API_KEY',
      message: 'Gemini API キーが無効です',
    }
  }

  // 時間割データの取得
  const timetableData = await getTimetableGenerationData(db, timetableId)
  if (!timetableData) {
    return {
      success: false,
      error: 'TIMETABLE_NOT_FOUND',
      message: '時間割データが見つかりません',
    }
  }

  const schoolId = timetableData.timetable.school.id
  const saturdayHours = timetableData.timetable.saturdayHours

  // 既存のスケジュールを削除
  await db.delete(schedules).where(eq(schedules.timetableId, timetableId))

  try {
    console.log('時間割生成開始')

    // プロンプトの生成
    const prompt = generateTimetablePrompt(timetableData, requirements)

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

    // 時間割データの詳細検証
    const validationResult = await validateGeneratedTimetable(
      db,
      geminiResult.data,
      schoolId,
      saturdayHours
    )

    if (!validationResult.isValid) {
      return {
        success: false,
        error: 'VALIDATION_FAILED',
        message: `検証エラー: ${validationResult.errors.join(', ')}`,
        retryable: true,
      }
    }

    // データベースにスケジュールを保存
    const slotsCreated = await saveSchedulesToDatabase(db, geminiResult.data)

    return {
      success: true,
      data: {
        timetableId,
        slotsCreated,
      },
    }
  } catch (error) {
    console.error('時間割生成エラー:', error)

    return {
      success: false,
      error: 'UNEXPECTED_ERROR',
      message: '予期しないエラーが発生しました',
      retryable: true,
    }
  }
}

/**
 * 生成されたスケジュールをデータベースに保存
 */
async function saveSchedulesToDatabase(db: DrizzleDb, timetableData: any): Promise<number> {
  const { timetableId, schedules: generatedSchedules } = timetableData

  if (!generatedSchedules || generatedSchedules.length === 0) {
    return 0
  }

  // バッチでスケジュールを挿入
  const scheduleInserts = generatedSchedules.map((schedule: any) => ({
    timetableId,
    classId: schedule.classId,
    subjectId: schedule.subjectId,
    teacherId: schedule.teacherId,
    classroomId: schedule.classroomId,
    dayOfWeek: schedule.dayOfWeek,
    period: schedule.period,
  }))

  await db.insert(schedules).values(scheduleInserts)

  return scheduleInserts.length
}

/**
 * 時間割生成の進行状況を取得
 */
export async function getTimetableGenerationStatus(
  db: DrizzleDb,
  timetableId: string
): Promise<{
  hasSchedules: boolean
  scheduleCount: number
  timetableExists: boolean
}> {
  try {
    // 時間割の存在確認
    const timetable = await db.select().from(timetables).where(eq(timetables.id, timetableId)).get()

    if (!timetable) {
      return {
        hasSchedules: false,
        scheduleCount: 0,
        timetableExists: false,
      }
    }

    // スケジュール数の取得
    const scheduleCount = await db
      .select({ count: schedules.id })
      .from(schedules)
      .where(eq(schedules.timetableId, timetableId))

    return {
      hasSchedules: scheduleCount.length > 0,
      scheduleCount: scheduleCount.length,
      timetableExists: true,
    }
  } catch (error) {
    console.error('時間割生成状況取得エラー:', error)
    return {
      hasSchedules: false,
      scheduleCount: 0,
      timetableExists: false,
    }
  }
}
