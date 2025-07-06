/**
 * 制約バリデーター エクスポートモジュール
 * 全ての制約バリデーターを一元管理
 */

export { ClassroomConflictValidator } from './classroom-conflict'
export { SubjectDistributionValidator } from './subject-distribution'
export { TeacherConflictValidator } from './teacher-conflict'
export { TimeSlotPreferenceValidator } from './time-slot-preference'

import { ClassroomConflictValidator } from './classroom-conflict'
import { SubjectDistributionValidator } from './subject-distribution'
// 制約バリデーター一覧（自動登録用）
import { TeacherConflictValidator } from './teacher-conflict'
import { TimeSlotPreferenceValidator } from './time-slot-preference'

export const DEFAULT_VALIDATORS = [
  new TeacherConflictValidator(),
  new ClassroomConflictValidator(),
  new SubjectDistributionValidator(),
  new TimeSlotPreferenceValidator(),
]
