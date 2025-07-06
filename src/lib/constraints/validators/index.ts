/**
 * 制約バリデーター エクスポートモジュール
 * 全ての制約バリデーターを一元管理
 */

export { TeacherConflictValidator } from './teacher-conflict'
export { ClassroomConflictValidator } from './classroom-conflict'
export { SubjectDistributionValidator } from './subject-distribution'
export { TimeSlotPreferenceValidator } from './time-slot-preference'

// 制約バリデーター一覧（自動登録用）
import { TeacherConflictValidator } from './teacher-conflict'
import { ClassroomConflictValidator } from './classroom-conflict'
import { SubjectDistributionValidator } from './subject-distribution'
import { TimeSlotPreferenceValidator } from './time-slot-preference'

export const DEFAULT_VALIDATORS = [
  new TeacherConflictValidator(),
  new ClassroomConflictValidator(),
  new SubjectDistributionValidator(),
  new TimeSlotPreferenceValidator()
]