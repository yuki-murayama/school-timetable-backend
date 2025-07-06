/**
 * 教師時間重複制約バリデーター
 * 同一教師が同一時間に複数クラスを担当することを禁止
 */

import { BaseConstraintValidator, type ConstraintContext, type ConstraintValidationResult, type ConstraintDefinition } from '../base'

export class TeacherConflictValidator extends BaseConstraintValidator {
  readonly definition: ConstraintDefinition = {
    id: 'teacher_conflict',
    name: '教師時間重複禁止',
    description: '同一教師が同一時間に複数のクラスを担当することを禁止します',
    category: 'teacher',
    enabled: true,
    priority: 10, // 最高優先度
    parameters: {
      strictMode: true, // 厳格モード（例外なし）
      allowPartTime: false // 非常勤講師の重複許可
    },
    applicableSchoolTypes: ['小学校', '中学校', '高校'],
    version: '1.0.0'
  }

  async validate(context: ConstraintContext): Promise<ConstraintValidationResult> {
    const { result, executionTime } = await this.measurePerformance(async () => {
      const violations = []
      const teacherSchedules = new Map<string, Map<string, Array<any>>>()
      
      // 教師ごとのスケジュールをグループ化
      for (const schedule of context.schedules) {
        if (!teacherSchedules.has(schedule.teacherId)) {
          teacherSchedules.set(schedule.teacherId, new Map())
        }
        
        const timeKey = `${schedule.dayOfWeek}-${schedule.period}`
        const teacherSlots = teacherSchedules.get(schedule.teacherId)!
        
        if (!teacherSlots.has(timeKey)) {
          teacherSlots.set(timeKey, [])
        }
        
        teacherSlots.get(timeKey)!.push(schedule)
      }
      
      // 重複をチェック
      for (const [teacherId, slots] of teacherSchedules) {
        const teacherName = context.metadata.teachers.find(t => t.id === teacherId)?.name || teacherId
        
        for (const [timeKey, schedules] of slots) {
          if (schedules.length > 1) {
            const [dayOfWeek, period] = timeKey.split('-').map(Number)
            const classNames = schedules.map(s => 
              context.metadata.classes.find(c => c.id === s.classId)?.name || s.classId
            )
            
            violations.push(this.createViolation(
              'TIME_CONFLICT',
              `教師「${teacherName}」が ${dayOfWeek}曜日 ${period}時限に複数クラス（${classNames.join('、')}）を担当しています`,
              'error',
              schedules,
              {
                teacherId,
                teacherName,
                timeKey,
                conflictingClasses: classNames,
                dayOfWeek,
                period
              }
            ))
          }
        }
      }
      
      return violations
    })
    
    return {
      isValid: result.length === 0,
      violations: result,
      performance: {
        executionTime,
        constraintType: this.definition.id
      }
    }
  }

  validateParameters(parameters: Record<string, any>): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (typeof parameters.strictMode !== 'boolean') {
      errors.push('strictMode は boolean 型である必要があります')
    }
    
    if (typeof parameters.allowPartTime !== 'boolean') {
      errors.push('allowPartTime は boolean 型である必要があります')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
}