/**
 * 制約条件システム エントリーポイント
 * 拡張可能な制約条件システムの統一インターフェース
 */

// コア型定義
export type {
  ConstraintViolation,
  ConstraintValidationResult,
  ConstraintDefinition,
  ConstraintContext,
  ConstraintValidator
} from './base'

// 基底クラス
export { BaseConstraintValidator, ConstraintManager } from './base'

// 制約バリデーター
export {
  TeacherConflictValidator,
  ClassroomConflictValidator,
  SubjectDistributionValidator,
  TimeSlotPreferenceValidator,
  DEFAULT_VALIDATORS
} from './validators'

// 管理システム
export {
  initializeConstraintManager,
  getConstraintManager,
  validateTimetableConstraints,
  updateConstraintSettings,
  getAvailableConstraints
} from './manager'

// 制約システムの初期化
export function initializeConstraintSystem() {
  const manager = initializeConstraintManager()
  
  console.log(`制約条件システム初期化完了: ${manager.getAvailableConstraints().length}個の制約を登録`)
  
  return manager
}