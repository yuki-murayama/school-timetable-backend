/**
 * 制約条件管理API
 * 制約条件の取得、設定、検証を提供
 */

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  getAvailableConstraints,
  getConstraintManager,
  updateConstraintSettings,
  validateTimetableConstraints,
} from '../lib/constraints/manager'
import { createDatabase, type Env } from '../lib/db'

const app = new Hono()

// 利用可能な制約条件一覧を取得
app.get('/', c => {
  try {
    const constraints = getAvailableConstraints()
    return c.json({
      success: true,
      data: {
        constraints,
        total: constraints.length,
        enabledCount: constraints.filter(c => c.enabled).length,
      },
    })
  } catch (error) {
    console.error('制約条件一覧取得エラー:', error)
    return c.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: '制約条件一覧の取得に失敗しました',
      },
      500
    )
  }
})

// 特定制約の詳細情報を取得
app.get('/:constraintId', c => {
  try {
    const constraintId = c.req.param('constraintId')
    const manager = getConstraintManager()
    const validator = manager.getValidator(constraintId)

    if (!validator) {
      return c.json(
        {
          success: false,
          error: 'CONSTRAINT_NOT_FOUND',
          message: '指定された制約条件が見つかりません',
        },
        404
      )
    }

    return c.json({
      success: true,
      data: {
        constraint: validator.definition,
      },
    })
  } catch (error) {
    console.error('制約条件詳細取得エラー:', error)
    return c.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: '制約条件詳細の取得に失敗しました',
      },
      500
    )
  }
})

// 制約条件設定の更新
const UpdateConstraintSchema = z.object({
  enabled: z.boolean().optional(),
  parameters: z.record(z.any()).optional(),
})

app.patch('/:constraintId', zValidator('json', UpdateConstraintSchema), c => {
  try {
    const constraintId = c.req.param('constraintId')
    const settings = c.req.valid('json')

    const result = updateConstraintSettings(constraintId, settings)

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: 'VALIDATION_FAILED',
          message: '制約条件設定の更新に失敗しました',
          details: result.errors,
        },
        400
      )
    }

    return c.json({
      success: true,
      message: '制約条件設定を更新しました',
    })
  } catch (error) {
    console.error('制約条件設定更新エラー:', error)
    return c.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: '制約条件設定の更新に失敗しました',
      },
      500
    )
  }
})

// 時間割の制約検証
const ValidateConstraintsSchema = z.object({
  schedules: z.array(
    z.object({
      classId: z.string(),
      subjectId: z.string(),
      teacherId: z.string(),
      classroomId: z.string(),
      dayOfWeek: z.number().min(1).max(6),
      period: z.number().min(1).max(6),
    })
  ),
  schoolId: z.string(),
  saturdayHours: z.number().min(0).max(8).default(0),
  enabledConstraints: z.array(z.string()).optional(),
  skipConstraints: z.array(z.string()).optional(),
})

app.post('/validate/:timetableId', zValidator('json', ValidateConstraintsSchema), async c => {
  try {
    const timetableId = c.req.param('timetableId')
    const { schedules, schoolId, saturdayHours, enabledConstraints, skipConstraints } =
      c.req.valid('json')

    const db = getDb(c.env.DB)

    const validationResult = await validateTimetableConstraints(db, timetableId, schedules, {
      schoolId,
      saturdayHours,
      enabledConstraints,
      skipConstraints,
    })

    return c.json({
      success: true,
      data: {
        isValid: validationResult.isValid,
        violations: validationResult.violations,
        summary: validationResult.summary,
      },
    })
  } catch (error) {
    console.error('制約検証エラー:', error)
    return c.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: '制約検証に失敗しました',
      },
      500
    )
  }
})

// 制約カテゴリ別の検証
app.post(
  '/validate/:timetableId/category/:category',
  zValidator('json', ValidateConstraintsSchema),
  async c => {
    try {
      const timetableId = c.req.param('timetableId')
      const category = c.req.param('category') as
        | 'teacher'
        | 'classroom'
        | 'time'
        | 'subject'
        | 'custom'
      const { schedules, schoolId, saturdayHours } = c.req.valid('json')

      const db = getDb(c.env.DB)
      const manager = getConstraintManager()

      // メタデータの取得（簡略化）
      const metadata = {
        classes: [],
        teachers: [],
        subjects: [],
        classrooms: [],
      }

      const context = {
        db,
        timetableId,
        schoolId,
        saturdayHours,
        schedules,
        metadata,
      }

      const validationResult = await manager.validateByCategory(context, category)

      return c.json({
        success: true,
        data: {
          category,
          isValid: validationResult.isValid,
          violations: validationResult.violations,
        },
      })
    } catch (error) {
      console.error('カテゴリ別制約検証エラー:', error)
      return c.json(
        {
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'カテゴリ別制約検証に失敗しました',
        },
        500
      )
    }
  }
)

export default app
