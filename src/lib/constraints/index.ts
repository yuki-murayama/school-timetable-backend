/**
 * 制約条件システム エントリーポイント
 * 拡張可能な制約条件システムの統一インターフェース
 */

// コア型定義
export type {
  ConstraintContext,
  ConstraintDefinition,
  ConstraintValidationResult,
  ConstraintValidator,
  ConstraintViolation,
} from './base'

// 基底クラス
export { BaseConstraintValidator, ConstraintManager } from './base'
// 管理システム
export {
  getAvailableConstraints,
  getConstraintManager,
  initializeConstraintManager,
  updateConstraintSettings,
  validateTimetableConstraints,
} from './manager'
// 制約バリデーター
export {
  ClassroomConflictValidator,
  DEFAULT_VALIDATORS,
  SubjectDistributionValidator,
  TeacherConflictValidator,
  TimeSlotPreferenceValidator,
} from './validators'

// 制約システムの初期化
export function initializeConstraintSystem() {
  const manager = initializeConstraintManager()

  console.log(
    `制約条件システム初期化完了: ${manager.getAvailableConstraints().length}個の制約を登録`
  )

  return manager
}
