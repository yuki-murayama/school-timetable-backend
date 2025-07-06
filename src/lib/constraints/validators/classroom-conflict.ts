/**
 * 教室時間重複制約バリデーター
 * 同一教室が同一時間に複数クラスで使用されることを禁止
 */

import {
  BaseConstraintValidator,
  type ConstraintContext,
  type ConstraintDefinition,
  type ConstraintValidationResult,
} from '../base'

export class ClassroomConflictValidator extends BaseConstraintValidator {
  readonly definition: ConstraintDefinition = {
    id: 'classroom_conflict',
    name: '教室時間重複禁止',
    description: '同一教室が同一時間に複数のクラスで使用されることを禁止します',
    category: 'classroom',
    enabled: true,
    priority: 9,
    parameters: {
      strictMode: true,
      allowSpecialRooms: false, // 特別教室の例外許可
      capacityCheck: true, // 教室定員チェック
    },
    applicableSchoolTypes: ['小学校', '中学校', '高校'],
    version: '1.0.0',
  }

  async validate(context: ConstraintContext): Promise<ConstraintValidationResult> {
    const { result, executionTime } = await this.measurePerformance(async () => {
      const violations = []
      const classroomSchedules = new Map<string, Map<string, Array<any>>>()

      // 教室ごとのスケジュールをグループ化
      for (const schedule of context.schedules) {
        if (!classroomSchedules.has(schedule.classroomId)) {
          classroomSchedules.set(schedule.classroomId, new Map())
        }

        const timeKey = `${schedule.dayOfWeek}-${schedule.period}`
        const classroomSlots = classroomSchedules.get(schedule.classroomId)!

        if (!classroomSlots.has(timeKey)) {
          classroomSlots.set(timeKey, [])
        }

        classroomSlots.get(timeKey)!.push(schedule)
      }

      // 重複をチェック
      for (const [classroomId, slots] of classroomSchedules) {
        const classroom = context.metadata.classrooms.find(c => c.id === classroomId)
        const classroomName = classroom?.name || classroomId

        for (const [timeKey, schedules] of slots) {
          if (schedules.length > 1) {
            const [dayOfWeek, period] = timeKey.split('-').map(Number)
            const classNames = schedules.map(
              s => context.metadata.classes.find(c => c.id === s.classId)?.name || s.classId
            )

            violations.push(
              this.createViolation(
                'TIME_CONFLICT',
                `教室「${classroomName}」が ${dayOfWeek}曜日 ${period}時限に複数クラス（${classNames.join('、')}）で使用されています`,
                'error',
                schedules,
                {
                  classroomId,
                  classroomName,
                  classroomType: classroom?.type,
                  timeKey,
                  conflictingClasses: classNames,
                  dayOfWeek,
                  period,
                }
              )
            )
          }

          // 定員チェック（設定されている場合）
          if (this.definition.parameters?.capacityCheck && classroom?.capacity) {
            const totalStudents = schedules.reduce((sum, schedule) => {
              // ここでは仮に1クラス30人として計算（実際はクラスの生徒数データが必要）
              return sum + 30
            }, 0)

            if (totalStudents > classroom.capacity) {
              violations.push(
                this.createViolation(
                  'CAPACITY_EXCEEDED',
                  `教室「${classroomName}」の定員（${classroom.capacity}人）を超過しています（${totalStudents}人）`,
                  'warning',
                  schedules,
                  {
                    classroomId,
                    classroomName,
                    capacity: classroom.capacity,
                    actualStudents: totalStudents,
                    dayOfWeek: schedules[0].dayOfWeek,
                    period: schedules[0].period,
                  }
                )
              )
            }
          }
        }
      }

      return violations
    })

    return {
      isValid: result.filter(v => v.severity === 'error').length === 0,
      violations: result,
      performance: {
        executionTime,
        constraintType: this.definition.id,
      },
    }
  }

  validateParameters(parameters: Record<string, any>): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (typeof parameters.strictMode !== 'boolean') {
      errors.push('strictMode は boolean 型である必要があります')
    }

    if (typeof parameters.allowSpecialRooms !== 'boolean') {
      errors.push('allowSpecialRooms は boolean 型である必要があります')
    }

    if (typeof parameters.capacityCheck !== 'boolean') {
      errors.push('capacityCheck は boolean 型である必要があります')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }
}
