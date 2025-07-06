/**
 * 時間割検証ロジック
 * Claude APIから生成された時間割データの妥当性をチェック
 */

import { and, eq } from 'drizzle-orm'
import type { DrizzleDb } from '../db'
import { classes, classrooms, subjects, teacherSubjects, teachers } from '../db/schema'

interface ScheduleSlot {
  classId: string
  subjectId: string
  teacherId: string
  classroomId: string
  dayOfWeek: number
  period: number
}

interface GeneratedTimetable {
  timetableId: string
  schedules: ScheduleSlot[]
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  conflictDetails?: ConflictDetail[]
}

interface ConflictDetail {
  type: 'teacher' | 'classroom' | 'invalid_id' | 'invalid_time' | 'subject_mismatch'
  description: string
  affectedSlots: ScheduleSlot[]
}

/**
 * 生成された時間割データを検証
 */
export async function validateGeneratedTimetable(
  db: DrizzleDb,
  timetableData: GeneratedTimetable,
  schoolId: string,
  saturdayHours: number
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const conflictDetails: ConflictDetail[] = []

  try {
    // 基本構造の検証
    if (!timetableData.timetableId) {
      errors.push('時間割IDが指定されていません')
    }

    if (!Array.isArray(timetableData.schedules)) {
      errors.push('スケジュールデータが配列形式ではありません')
      return { isValid: false, errors, warnings }
    }

    // 学校内の有効なIDを取得
    const [validClasses, validSubjects, validTeachers, validClassrooms, teacherSubjectMappings] =
      await Promise.all([
        db.select({ id: classes.id }).from(classes).where(eq(classes.schoolId, schoolId)),
        db.select({ id: subjects.id }).from(subjects).where(eq(subjects.schoolId, schoolId)),
        db.select({ id: teachers.id }).from(teachers).where(eq(teachers.schoolId, schoolId)),
        db.select({ id: classrooms.id }).from(classrooms).where(eq(classrooms.schoolId, schoolId)),
        db
          .select({
            teacherId: teacherSubjects.teacherId,
            subjectId: teacherSubjects.subjectId,
          })
          .from(teacherSubjects)
          .leftJoin(teachers, eq(teacherSubjects.teacherId, teachers.id))
          .where(eq(teachers.schoolId, schoolId)),
      ])

    const validClassIds = new Set(validClasses.map(c => c.id))
    const validSubjectIds = new Set(validSubjects.map(s => s.id))
    const validTeacherIds = new Set(validTeachers.map(t => t.id))
    const validClassroomIds = new Set(validClassrooms.map(c => c.id))

    // 教師-教科のマッピングを作成
    const teacherSubjectMap = new Map<string, Set<string>>()
    for (const mapping of teacherSubjectMappings) {
      if (!teacherSubjectMap.has(mapping.teacherId)) {
        teacherSubjectMap.set(mapping.teacherId, new Set())
      }
      teacherSubjectMap.get(mapping.teacherId)!.add(mapping.subjectId)
    }

    // 時間枠の重複チェック用
    const teacherSchedules = new Map<string, Set<string>>()
    const classroomSchedules = new Map<string, Set<string>>()

    // 各スケジュールスロットを検証
    for (const slot of timetableData.schedules) {
      const slotErrors = validateScheduleSlot(
        slot,
        validClassIds,
        validSubjectIds,
        validTeacherIds,
        validClassroomIds,
        teacherSubjectMap,
        saturdayHours
      )

      if (slotErrors.length > 0) {
        errors.push(...slotErrors)
        conflictDetails.push({
          type: 'invalid_id',
          description: `スロット検証エラー: ${slotErrors.join(', ')}`,
          affectedSlots: [slot],
        })
        continue
      }

      // 時間枠の重複チェック
      const timeKey = `${slot.dayOfWeek}-${slot.period}`

      // 教師の重複チェック
      if (!teacherSchedules.has(slot.teacherId)) {
        teacherSchedules.set(slot.teacherId, new Set())
      }

      if (teacherSchedules.get(slot.teacherId)!.has(timeKey)) {
        const conflictingSlots = timetableData.schedules.filter(
          s =>
            s.teacherId === slot.teacherId &&
            s.dayOfWeek === slot.dayOfWeek &&
            s.period === slot.period
        )

        conflictDetails.push({
          type: 'teacher',
          description: `教師 ${slot.teacherId} が ${slot.dayOfWeek}曜日 ${slot.period}時限に重複して配置されています`,
          affectedSlots: conflictingSlots,
        })
        errors.push(`教師の時間重複: ${slot.teacherId} (${slot.dayOfWeek}曜日 ${slot.period}時限)`)
      }
      teacherSchedules.get(slot.teacherId)!.add(timeKey)

      // 教室の重複チェック
      if (!classroomSchedules.has(slot.classroomId)) {
        classroomSchedules.set(slot.classroomId, new Set())
      }

      if (classroomSchedules.get(slot.classroomId)!.has(timeKey)) {
        const conflictingSlots = timetableData.schedules.filter(
          s =>
            s.classroomId === slot.classroomId &&
            s.dayOfWeek === slot.dayOfWeek &&
            s.period === slot.period
        )

        conflictDetails.push({
          type: 'classroom',
          description: `教室 ${slot.classroomId} が ${slot.dayOfWeek}曜日 ${slot.period}時限に重複して配置されています`,
          affectedSlots: conflictingSlots,
        })
        errors.push(
          `教室の時間重複: ${slot.classroomId} (${slot.dayOfWeek}曜日 ${slot.period}時限)`
        )
      }
      classroomSchedules.get(slot.classroomId)!.add(timeKey)
    }

    // 警告の生成
    if (timetableData.schedules.length === 0) {
      warnings.push('生成されたスケジュールが空です')
    }

    if (timetableData.schedules.length < validClasses.length * 5) {
      warnings.push('生成されたスケジュール数が少ない可能性があります')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      conflictDetails: conflictDetails.length > 0 ? conflictDetails : undefined,
    }
  } catch (error) {
    console.error('時間割検証エラー:', error)
    return {
      isValid: false,
      errors: ['時間割検証中にエラーが発生しました'],
      warnings,
    }
  }
}

/**
 * 個別のスケジュールスロットを検証
 */
function validateScheduleSlot(
  slot: ScheduleSlot,
  validClassIds: Set<string>,
  validSubjectIds: Set<string>,
  validTeacherIds: Set<string>,
  validClassroomIds: Set<string>,
  teacherSubjectMap: Map<string, Set<string>>,
  saturdayHours: number
): string[] {
  const errors: string[] = []

  // 必須フィールドの検証
  if (!slot.classId) errors.push('クラスIDが未指定')
  if (!slot.subjectId) errors.push('教科IDが未指定')
  if (!slot.teacherId) errors.push('教師IDが未指定')
  if (!slot.classroomId) errors.push('教室IDが未指定')

  // ID の有効性検証
  if (slot.classId && !validClassIds.has(slot.classId)) {
    errors.push(`無効なクラスID: ${slot.classId}`)
  }
  if (slot.subjectId && !validSubjectIds.has(slot.subjectId)) {
    errors.push(`無効な教科ID: ${slot.subjectId}`)
  }
  if (slot.teacherId && !validTeacherIds.has(slot.teacherId)) {
    errors.push(`無効な教師ID: ${slot.teacherId}`)
  }
  if (slot.classroomId && !validClassroomIds.has(slot.classroomId)) {
    errors.push(`無効な教室ID: ${slot.classroomId}`)
  }

  // 時間の有効性検証
  if (slot.dayOfWeek < 1 || slot.dayOfWeek > 6) {
    errors.push(`無効な曜日: ${slot.dayOfWeek}`)
  }
  if (slot.period < 1 || slot.period > 6) {
    errors.push(`無効な時限: ${slot.period}`)
  }

  // 土曜日の時間数制限
  if (slot.dayOfWeek === 6 && slot.period > saturdayHours) {
    errors.push(`土曜日の時限が制限を超えています: ${slot.period} > ${saturdayHours}`)
  }

  // 教師-教科の対応関係検証
  if (slot.teacherId && slot.subjectId) {
    const teacherSubjects = teacherSubjectMap.get(slot.teacherId)
    if (teacherSubjects && !teacherSubjects.has(slot.subjectId)) {
      errors.push(`教師 ${slot.teacherId} は教科 ${slot.subjectId} を担当していません`)
    }
  }

  return errors
}

/**
 * 時間割データの構造を検証
 */
export function validateTimetableStructure(data: any): data is GeneratedTimetable {
  if (!data || typeof data !== 'object') {
    console.log('Invalid data: not an object')
    return false
  }

  // Geminiが返すデータ構造に対応
  if (data.timetable && typeof data.timetable === 'object') {
    // Gemini形式: {success: true, timetable: {timetableId, schedules}}
    if (!data.timetable.timetableId || typeof data.timetable.timetableId !== 'string') {
      console.log('Invalid timetable: missing or invalid timetableId')
      return false
    }

    if (!Array.isArray(data.timetable.schedules)) {
      console.log('Invalid timetable: schedules is not an array')
      return false
    }

    // データを正規化
    data.timetableId = data.timetable.timetableId
    data.schedules = data.timetable.schedules
  } else {
    // 既存形式: {timetableId, schedules}
    if (!data.timetableId || typeof data.timetableId !== 'string') {
      console.log('Invalid data: missing or invalid timetableId')
      return false
    }

    if (!Array.isArray(data.schedules)) {
      console.log('Invalid data: schedules is not an array')
      return false
    }
  }

  // 各スケジュールスロットの構造を検証
  for (const slot of data.schedules) {
    if (!slot || typeof slot !== 'object') {
      return false
    }

    const requiredFields = [
      'classId',
      'subjectId',
      'teacherId',
      'classroomId',
      'dayOfWeek',
      'period',
    ]
    for (const field of requiredFields) {
      if (!(field in slot)) {
        return false
      }
    }

    // 数値フィールドの検証
    if (typeof slot.dayOfWeek !== 'number' || typeof slot.period !== 'number') {
      return false
    }

    // 文字列フィールドの検証
    if (
      typeof slot.classId !== 'string' ||
      typeof slot.subjectId !== 'string' ||
      typeof slot.teacherId !== 'string' ||
      typeof slot.classroomId !== 'string'
    ) {
      return false
    }
  }

  return true
}
