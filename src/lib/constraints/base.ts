/**
 * 拡張可能な制約条件システム基盤
 * プラガブル制約バリデーターアーキテクチャ
 */

import type { DrizzleDb } from '../db'

// 制約違反情報
export interface ConstraintViolation {
  code: string
  message: string
  severity: 'error' | 'warning' | 'info'
  affectedSchedules: Array<{
    classId: string
    dayOfWeek: number
    period: number
    teacherId?: string
    classroomId?: string
    subjectId?: string
  }>
  metadata?: Record<string, any>
}

// 制約検証結果
export interface ConstraintValidationResult {
  isValid: boolean
  violations: ConstraintViolation[]
  performance?: {
    executionTime: number
    constraintType: string
  }
}

// 制約条件の基本情報
export interface ConstraintDefinition {
  id: string
  name: string
  description: string
  category: 'teacher' | 'classroom' | 'time' | 'subject' | 'custom'
  enabled: boolean
  priority: number // 1-10, 高いほど優先
  parameters?: Record<string, any>
  applicableSchoolTypes?: string[] // '小学校', '中学校', '高校'
  version: string
}

// 制約検証コンテキスト
export interface ConstraintContext {
  db: DrizzleDb
  timetableId: string
  schoolId: string
  saturdayHours: number
  schedules: Array<{
    classId: string
    subjectId: string
    teacherId: string
    classroomId: string
    dayOfWeek: number
    period: number
  }>
  metadata: {
    classes: Array<{ id: string; name: string; grade: number }>
    teachers: Array<{ id: string; name: string; subjects: Array<{ id: string; name: string }> }>
    subjects: Array<{ id: string; name: string }>
    classrooms: Array<{ id: string; name: string; type: string; capacity?: number }>
  }
}

// 制約バリデーターの基底インターフェース
export interface ConstraintValidator {
  readonly definition: ConstraintDefinition

  /**
   * 制約条件を検証
   */
  validate(context: ConstraintContext): Promise<ConstraintValidationResult>

  /**
   * 制約条件が適用可能かチェック
   */
  isApplicable(context: ConstraintContext): boolean

  /**
   * パラメータのバリデーション
   */
  validateParameters(parameters: Record<string, any>): { isValid: boolean; errors: string[] }
}

// 制約バリデーターの抽象基底クラス
export abstract class BaseConstraintValidator implements ConstraintValidator {
  abstract readonly definition: ConstraintDefinition

  abstract validate(context: ConstraintContext): Promise<ConstraintValidationResult>

  isApplicable(context: ConstraintContext): boolean {
    // デフォルト実装: 常に適用可能
    return this.definition.enabled
  }

  validateParameters(parameters: Record<string, any>): { isValid: boolean; errors: string[] } {
    // デフォルト実装: パラメータ検証なし
    return { isValid: true, errors: [] }
  }

  protected createViolation(
    code: string,
    message: string,
    severity: 'error' | 'warning' | 'info' = 'error',
    affectedSchedules: Array<any> = [],
    metadata?: Record<string, any>
  ): ConstraintViolation {
    return {
      code: `${this.definition.id}_${code}`,
      message,
      severity,
      affectedSchedules,
      metadata,
    }
  }

  protected measurePerformance<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; executionTime: number }> {
    const start = performance.now()
    return fn().then(result => ({
      result,
      executionTime: performance.now() - start,
    }))
  }
}

// 制約管理サービス
export class ConstraintManager {
  private validators = new Map<string, ConstraintValidator>()

  /**
   * 制約バリデーターを登録
   */
  register(validator: ConstraintValidator): void {
    this.validators.set(validator.definition.id, validator)
  }

  /**
   * 制約バリデーターを削除
   */
  unregister(constraintId: string): void {
    this.validators.delete(constraintId)
  }

  /**
   * 利用可能な制約条件一覧を取得
   */
  getAvailableConstraints(): ConstraintDefinition[] {
    return Array.from(this.validators.values()).map(v => v.definition)
  }

  /**
   * 有効な制約条件を取得
   */
  getEnabledConstraints(): ConstraintValidator[] {
    return Array.from(this.validators.values())
      .filter(v => v.definition.enabled)
      .sort((a, b) => b.definition.priority - a.definition.priority)
  }

  /**
   * 特定の制約バリデーターを取得
   */
  getValidator(constraintId: string): ConstraintValidator | undefined {
    return this.validators.get(constraintId)
  }

  /**
   * 全制約条件を検証
   */
  async validateAll(context: ConstraintContext): Promise<{
    isValid: boolean
    violations: ConstraintViolation[]
    summary: {
      totalConstraints: number
      appliedConstraints: number
      executionTime: number
      violationsBySeverity: Record<string, number>
    }
  }> {
    const start = performance.now()
    const allViolations: ConstraintViolation[] = []
    const enabledValidators = this.getEnabledConstraints()

    let appliedConstraints = 0

    for (const validator of enabledValidators) {
      if (!validator.isApplicable(context)) {
        continue
      }

      appliedConstraints++

      try {
        const result = await validator.validate(context)
        allViolations.push(...result.violations)
      } catch (error) {
        console.error(`制約検証エラー [${validator.definition.id}]:`, error)
        allViolations.push({
          code: `${validator.definition.id}_VALIDATION_ERROR`,
          message: `制約検証中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error',
          affectedSchedules: [],
        })
      }
    }

    const violationsBySeverity = {
      error: allViolations.filter(v => v.severity === 'error').length,
      warning: allViolations.filter(v => v.severity === 'warning').length,
      info: allViolations.filter(v => v.severity === 'info').length,
    }

    return {
      isValid: violationsBySeverity.error === 0,
      violations: allViolations,
      summary: {
        totalConstraints: enabledValidators.length,
        appliedConstraints,
        executionTime: performance.now() - start,
        violationsBySeverity,
      },
    }
  }

  /**
   * 特定カテゴリの制約のみ検証
   */
  async validateByCategory(
    context: ConstraintContext,
    category: ConstraintDefinition['category']
  ): Promise<ConstraintValidationResult> {
    const validators = this.getEnabledConstraints().filter(
      v => v.definition.category === category && v.isApplicable(context)
    )

    const allViolations: ConstraintViolation[] = []

    for (const validator of validators) {
      const result = await validator.validate(context)
      allViolations.push(...result.violations)
    }

    return {
      isValid: allViolations.filter(v => v.severity === 'error').length === 0,
      violations: allViolations,
    }
  }
}
