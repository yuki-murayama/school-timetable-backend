/**
 * 時間帯優先制約バリデーター
 * 午前/午後の教科配置優先設定を検証
 */

import {
  BaseConstraintValidator,
  type ConstraintContext,
  type ConstraintDefinition,
  type ConstraintValidationResult,
} from '../base'

export class TimeSlotPreferenceValidator extends BaseConstraintValidator {
  readonly definition: ConstraintDefinition = {
    id: 'time_slot_preference',
    name: '時間帯配置優先',
    description: '教科の午前・午後配置優先設定に従って適切に配置されているかを検証します',
    category: 'time',
    enabled: true,
    priority: 5,
    parameters: {
      morningSubjects: [], // 午前優先教科ID
      afternoonSubjects: [], // 午後優先教科ID
      strictMode: false, // 厳格モード（優先設定を必須とする）
      morningPeriods: [1, 2, 3], // 午前時限の定義
      afternoonPeriods: [4, 5, 6], // 午後時限の定義
    },
    applicableSchoolTypes: ['小学校', '中学校', '高校'],
    version: '1.0.0',
  }

  async validate(context: ConstraintContext): Promise<ConstraintValidationResult> {
    const { result, executionTime } = await this.measurePerformance(async () => {
      const violations = []
      const { morningSubjects, afternoonSubjects, strictMode, morningPeriods, afternoonPeriods } =
        this.definition.parameters!

      // 午前優先教科のチェック
      for (const subjectId of morningSubjects) {
        const subject = context.metadata.subjects.find(s => s.id === subjectId)
        const subjectName = subject?.name || subjectId

        const subjectSchedules = context.schedules.filter(s => s.subjectId === subjectId)
        const afternoonSchedules = subjectSchedules.filter(s => afternoonPeriods.includes(s.period))

        if (afternoonSchedules.length > 0) {
          const severity = strictMode ? 'error' : 'warning'
          const classIds = [...new Set(afternoonSchedules.map(s => s.classId))]
          const classNames = classIds.map(
            id => context.metadata.classes.find(c => c.id === id)?.name || id
          )

          violations.push(
            this.createViolation(
              'MORNING_SUBJECT_IN_AFTERNOON',
              `午前優先教科「${subjectName}」が午後時間帯に配置されています（対象クラス: ${classNames.join('、')}）`,
              severity,
              afternoonSchedules,
              {
                subjectId,
                subjectName,
                violatingClasses: classNames,
                violatingSlots: afternoonSchedules.map(s => ({
                  classId: s.classId,
                  dayOfWeek: s.dayOfWeek,
                  period: s.period,
                })),
              }
            )
          )
        }
      }

      // 午後優先教科のチェック
      for (const subjectId of afternoonSubjects) {
        const subject = context.metadata.subjects.find(s => s.id === subjectId)
        const subjectName = subject?.name || subjectId

        const subjectSchedules = context.schedules.filter(s => s.subjectId === subjectId)
        const morningSchedules = subjectSchedules.filter(s => morningPeriods.includes(s.period))

        if (morningSchedules.length > 0) {
          const severity = strictMode ? 'error' : 'warning'
          const classIds = [...new Set(morningSchedules.map(s => s.classId))]
          const classNames = classIds.map(
            id => context.metadata.classes.find(c => c.id === id)?.name || id
          )

          violations.push(
            this.createViolation(
              'AFTERNOON_SUBJECT_IN_MORNING',
              `午後優先教科「${subjectName}」が午前時間帯に配置されています（対象クラス: ${classNames.join('、')}）`,
              severity,
              morningSchedules,
              {
                subjectId,
                subjectName,
                violatingClasses: classNames,
                violatingSlots: morningSchedules.map(s => ({
                  classId: s.classId,
                  dayOfWeek: s.dayOfWeek,
                  period: s.period,
                })),
              }
            )
          )
        }
      }

      // 時間帯バランス分析（情報提供）
      const timeSlotAnalysis = this.analyzeTimeSlotDistribution(
        context.schedules,
        morningPeriods,
        afternoonPeriods
      )
      if (timeSlotAnalysis.imbalance > 0.3) {
        // 30%以上の偏りがある場合
        violations.push(
          this.createViolation(
            'TIME_SLOT_IMBALANCE',
            `時間帯配置に大きな偏りがあります（午前: ${timeSlotAnalysis.morningRatio.toFixed(1)}%, 午後: ${timeSlotAnalysis.afternoonRatio.toFixed(1)}%）`,
            'info',
            [],
            {
              morningRatio: timeSlotAnalysis.morningRatio,
              afternoonRatio: timeSlotAnalysis.afternoonRatio,
              imbalanceScore: timeSlotAnalysis.imbalance,
              totalSchedules: context.schedules.length,
            }
          )
        )
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

    if (!Array.isArray(parameters.morningSubjects)) {
      errors.push('morningSubjects は配列である必要があります')
    }

    if (!Array.isArray(parameters.afternoonSubjects)) {
      errors.push('afternoonSubjects は配列である必要があります')
    }

    if (typeof parameters.strictMode !== 'boolean') {
      errors.push('strictMode は boolean 型である必要があります')
    }

    if (
      !Array.isArray(parameters.morningPeriods) ||
      !parameters.morningPeriods.every((p: any) => typeof p === 'number')
    ) {
      errors.push('morningPeriods は数値の配列である必要があります')
    }

    if (
      !Array.isArray(parameters.afternoonPeriods) ||
      !parameters.afternoonPeriods.every((p: any) => typeof p === 'number')
    ) {
      errors.push('afternoonPeriods は数値の配列である必要があります')
    }

    // 重複チェック
    const morningSet = new Set(parameters.morningPeriods)
    const afternoonSet = new Set(parameters.afternoonPeriods)
    const overlap = [...morningSet].filter(p => afternoonSet.has(p))
    if (overlap.length > 0) {
      errors.push(`morningPeriods と afternoonPeriods に重複があります: ${overlap.join(', ')}`)
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  private analyzeTimeSlotDistribution(
    schedules: any[],
    morningPeriods: number[],
    afternoonPeriods: number[]
  ): {
    morningRatio: number
    afternoonRatio: number
    imbalance: number
  } {
    const morningCount = schedules.filter(s => morningPeriods.includes(s.period)).length
    const afternoonCount = schedules.filter(s => afternoonPeriods.includes(s.period)).length
    const total = morningCount + afternoonCount

    if (total === 0) {
      return { morningRatio: 0, afternoonRatio: 0, imbalance: 0 }
    }

    const morningRatio = (morningCount / total) * 100
    const afternoonRatio = (afternoonCount / total) * 100
    const imbalance = Math.abs(morningRatio - afternoonRatio) / 100

    return { morningRatio, afternoonRatio, imbalance }
  }
}
