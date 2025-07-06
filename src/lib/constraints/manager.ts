/**
 * 制約条件管理システム
 * 制約バリデーターの一元管理とコンテキスト提供
 */

import type { DrizzleDb } from '../db'
import { ConstraintManager } from './base'
import { DEFAULT_VALIDATORS } from './validators'

// グローバル制約マネージャーインスタンス
let globalConstraintManager: ConstraintManager | null = null

/**
 * 制約マネージャーを初期化（デフォルト制約を登録）
 */
export function initializeConstraintManager(): ConstraintManager {
  if (globalConstraintManager) {
    return globalConstraintManager
  }

  const manager = new ConstraintManager()

  // デフォルト制約バリデーターを登録
  for (const validator of DEFAULT_VALIDATORS) {
    manager.register(validator)
  }

  globalConstraintManager = manager
  return manager
}

/**
 * グローバル制約マネージャーを取得
 */
export function getConstraintManager(): ConstraintManager {
  if (!globalConstraintManager) {
    return initializeConstraintManager()
  }
  return globalConstraintManager
}

/**
 * 時間割制約検証のエントリーポイント
 */
export async function validateTimetableConstraints(
  db: DrizzleDb,
  timetableId: string,
  schedules: Array<{
    classId: string
    subjectId: string
    teacherId: string
    classroomId: string
    dayOfWeek: number
    period: number
  }>,
  options: {
    schoolId: string
    saturdayHours: number
    enabledConstraints?: string[] // 特定制約のみ実行
    skipConstraints?: string[] // 特定制約をスキップ
  }
) {
  const manager = getConstraintManager()

  // メタデータの取得
  const metadata = await fetchConstraintMetadata(db, options.schoolId)

  const context = {
    db,
    timetableId,
    schoolId: options.schoolId,
    saturdayHours: options.saturdayHours,
    schedules,
    metadata,
  }

  // 制約フィルタリング
  if (options.enabledConstraints) {
    // 指定された制約のみ有効化
    const allConstraints = manager.getAvailableConstraints()
    for (const constraint of allConstraints) {
      const validator = manager.getValidator(constraint.id)
      if (validator) {
        validator.definition.enabled = options.enabledConstraints.includes(constraint.id)
      }
    }
  }

  if (options.skipConstraints) {
    // 指定された制約を無効化
    for (const constraintId of options.skipConstraints) {
      const validator = manager.getValidator(constraintId)
      if (validator) {
        validator.definition.enabled = false
      }
    }
  }

  return await manager.validateAll(context)
}

/**
 * 制約検証に必要なメタデータを取得
 */
async function fetchConstraintMetadata(db: DrizzleDb, schoolId: string) {
  // TODO: 実際のデータベースクエリを実装
  // ここでは型安全性のためのダミーデータを返す
  return {
    classes: [] as Array<{ id: string; name: string; grade: number }>,
    teachers: [] as Array<{
      id: string
      name: string
      subjects: Array<{ id: string; name: string }>
    }>,
    subjects: [] as Array<{ id: string; name: string }>,
    classrooms: [] as Array<{ id: string; name: string; type: string; capacity?: number }>,
  }
}

/**
 * 制約条件設定の更新
 */
export function updateConstraintSettings(
  constraintId: string,
  settings: {
    enabled?: boolean
    parameters?: Record<string, any>
  }
): { success: boolean; errors: string[] } {
  const manager = getConstraintManager()
  const validator = manager.getValidator(constraintId)

  if (!validator) {
    return {
      success: false,
      errors: [`制約 ${constraintId} が見つかりません`],
    }
  }

  const errors: string[] = []

  // パラメータの検証
  if (settings.parameters) {
    const validation = validator.validateParameters(settings.parameters)
    if (!validation.isValid) {
      errors.push(...validation.errors)
    }
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  // 設定の更新
  if (settings.enabled !== undefined) {
    validator.definition.enabled = settings.enabled
  }

  if (settings.parameters) {
    validator.definition.parameters = {
      ...validator.definition.parameters,
      ...settings.parameters,
    }
  }

  return { success: true, errors: [] }
}

/**
 * 利用可能な制約条件一覧の取得
 */
export function getAvailableConstraints() {
  const manager = getConstraintManager()
  return manager.getAvailableConstraints().map(constraint => ({
    ...constraint,
    // パラメータのスキーマ情報を追加
    parameterSchema: generateParameterSchema(constraint.id),
  }))
}

/**
 * 制約条件のパラメータスキーマを生成
 */
function generateParameterSchema(constraintId: string): Record<string, any> {
  const manager = getConstraintManager()
  const validator = manager.getValidator(constraintId)

  if (!validator || !validator.definition.parameters) {
    return {}
  }

  // パラメータの型情報を生成（実装簡略化）
  const schema: Record<string, any> = {}

  for (const [key, value] of Object.entries(validator.definition.parameters)) {
    schema[key] = {
      type: typeof value,
      default: value,
      // 実際の実装では、より詳細なスキーマ情報を提供
    }
  }

  return schema
}
