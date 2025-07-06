/**
 * 教科配置制約バリデーター
 * 教科の時間割配置バランスと分散を検証
 */

import {
  BaseConstraintValidator,
  type ConstraintContext,
  type ConstraintDefinition,
  type ConstraintValidationResult,
} from '../base'

export class SubjectDistributionValidator extends BaseConstraintValidator {
  readonly definition: ConstraintDefinition = {
    id: 'subject_distribution',
    name: '教科配置バランス',
    description: '教科の時間割配置が適切にバランスされ、分散されているかを検証します',
    category: 'subject',
    enabled: true,
    priority: 7,
    parameters: {
      distributionPolicy: 'balanced', // 'balanced' | 'concentrated' | 'flexible'
      maxConsecutiveHours: 2, // 同一教科の連続時限数上限
      minDaySpread: 2, // 週あたり最小分散日数
      avoidFirstPeriod: [], // 1時限目回避教科ID
      avoidLastPeriod: [], // 最終時限回避教科ID
    },
    applicableSchoolTypes: ['小学校', '中学校', '高校'],
    version: '1.0.0',
  }

  async validate(context: ConstraintContext): Promise<ConstraintValidationResult> {
    const { result, executionTime } = await this.measurePerformance(async () => {
      const violations = []
      const {
        distributionPolicy,
        maxConsecutiveHours,
        minDaySpread,
        avoidFirstPeriod,
        avoidLastPeriod,
      } = this.definition.parameters!

      // クラス別に教科配置を分析
      const classesBySubject = this.groupSchedulesByClassAndSubject(context.schedules)

      for (const [classId, subjectSchedules] of classesBySubject) {
        const className = context.metadata.classes.find(c => c.id === classId)?.name || classId

        for (const [subjectId, schedules] of subjectSchedules) {
          const subject = context.metadata.subjects.find(s => s.id === subjectId)
          const subjectName = subject?.name || subjectId

          // 連続時限チェック
          const consecutiveViolations = this.checkConsecutiveHours(schedules, maxConsecutiveHours)
          for (const violation of consecutiveViolations) {
            violations.push(
              this.createViolation(
                'CONSECUTIVE_HOURS_EXCEEDED',
                `クラス「${className}」の教科「${subjectName}」が ${violation.dayOfWeek}曜日に${violation.consecutiveCount}時限連続で配置されています（上限: ${maxConsecutiveHours}時限）`,
                'warning',
                violation.schedules,
                {
                  classId,
                  className,
                  subjectId,
                  subjectName,
                  consecutiveCount: violation.consecutiveCount,
                  maxAllowed: maxConsecutiveHours,
                  dayOfWeek: violation.dayOfWeek,
                }
              )
            )
          }

          // 週間分散チェック
          const daySpread = this.calculateDaySpread(schedules)
          if (daySpread < minDaySpread && schedules.length >= minDaySpread) {
            violations.push(
              this.createViolation(
                'INSUFFICIENT_DAY_SPREAD',
                `クラス「${className}」の教科「${subjectName}」の週間分散が不足しています（実際: ${daySpread}日、推奨: ${minDaySpread}日以上）`,
                'info',
                schedules,
                {
                  classId,
                  className,
                  subjectId,
                  subjectName,
                  actualSpread: daySpread,
                  recommendedSpread: minDaySpread,
                }
              )
            )
          }

          // 1時限目回避チェック
          if (avoidFirstPeriod.includes(subjectId)) {
            const firstPeriodSchedules = schedules.filter(s => s.period === 1)
            if (firstPeriodSchedules.length > 0) {
              violations.push(
                this.createViolation(
                  'FIRST_PERIOD_VIOLATION',
                  `教科「${subjectName}」がクラス「${className}」の1時限目に配置されています（回避対象教科）`,
                  'warning',
                  firstPeriodSchedules,
                  {
                    classId,
                    className,
                    subjectId,
                    subjectName,
                    violatingDays: firstPeriodSchedules.map(s => s.dayOfWeek),
                  }
                )
              )
            }
          }

          // 最終時限回避チェック
          if (avoidLastPeriod.includes(subjectId)) {
            const maxPeriod = context.saturdayHours > 0 ? 6 : 5 // 土曜授業がある場合は6時限、なければ5時限
            const lastPeriodSchedules = schedules.filter(s => s.period === maxPeriod)
            if (lastPeriodSchedules.length > 0) {
              violations.push(
                this.createViolation(
                  'LAST_PERIOD_VIOLATION',
                  `教科「${subjectName}」がクラス「${className}」の最終時限（${maxPeriod}時限目）に配置されています（回避対象教科）`,
                  'warning',
                  lastPeriodSchedules,
                  {
                    classId,
                    className,
                    subjectId,
                    subjectName,
                    violatingDays: lastPeriodSchedules.map(s => s.dayOfWeek),
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

    if (!['balanced', 'concentrated', 'flexible'].includes(parameters.distributionPolicy)) {
      errors.push(
        'distributionPolicy は "balanced", "concentrated", "flexible" のいずれかである必要があります'
      )
    }

    if (typeof parameters.maxConsecutiveHours !== 'number' || parameters.maxConsecutiveHours < 1) {
      errors.push('maxConsecutiveHours は 1 以上の数値である必要があります')
    }

    if (typeof parameters.minDaySpread !== 'number' || parameters.minDaySpread < 1) {
      errors.push('minDaySpread は 1 以上の数値である必要があります')
    }

    if (!Array.isArray(parameters.avoidFirstPeriod)) {
      errors.push('avoidFirstPeriod は配列である必要があります')
    }

    if (!Array.isArray(parameters.avoidLastPeriod)) {
      errors.push('avoidLastPeriod は配列である必要があります')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  private groupSchedulesByClassAndSubject(schedules: any[]): Map<string, Map<string, any[]>> {
    const grouped = new Map<string, Map<string, any[]>>()

    for (const schedule of schedules) {
      if (!grouped.has(schedule.classId)) {
        grouped.set(schedule.classId, new Map())
      }

      const classSchedules = grouped.get(schedule.classId)!
      if (!classSchedules.has(schedule.subjectId)) {
        classSchedules.set(schedule.subjectId, [])
      }

      classSchedules.get(schedule.subjectId)!.push(schedule)
    }

    return grouped
  }

  private checkConsecutiveHours(
    schedules: any[],
    maxConsecutive: number
  ): Array<{
    dayOfWeek: number
    consecutiveCount: number
    schedules: any[]
  }> {
    const violations = []
    const schedulesByDay = new Map<number, any[]>()

    // 曜日別にグループ化
    for (const schedule of schedules) {
      if (!schedulesByDay.has(schedule.dayOfWeek)) {
        schedulesByDay.set(schedule.dayOfWeek, [])
      }
      schedulesByDay.get(schedule.dayOfWeek)!.push(schedule)
    }

    // 各曜日で連続時限をチェック
    for (const [dayOfWeek, daySchedules] of schedulesByDay) {
      daySchedules.sort((a, b) => a.period - b.period)

      let consecutiveCount = 1
      let consecutiveSchedules = [daySchedules[0]]

      for (let i = 1; i < daySchedules.length; i++) {
        if (daySchedules[i].period === daySchedules[i - 1].period + 1) {
          consecutiveCount++
          consecutiveSchedules.push(daySchedules[i])
        } else {
          if (consecutiveCount > maxConsecutive) {
            violations.push({
              dayOfWeek,
              consecutiveCount,
              schedules: consecutiveSchedules,
            })
          }
          consecutiveCount = 1
          consecutiveSchedules = [daySchedules[i]]
        }
      }

      // 最後の連続ブロックもチェック
      if (consecutiveCount > maxConsecutive) {
        violations.push({
          dayOfWeek,
          consecutiveCount,
          schedules: consecutiveSchedules,
        })
      }
    }

    return violations
  }

  private calculateDaySpread(schedules: any[]): number {
    const days = new Set(schedules.map(s => s.dayOfWeek))
    return days.size
  }
}
