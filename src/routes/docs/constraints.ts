/**
 * 制約条件API OpenAPI ドキュメント定義
 */

import { createRoute, z } from '@hono/zod-openapi'
import {
  ConstraintDefinitionSchema,
  ConstraintValidationResultSchema,
  ConstraintViolationSchema,
  createAPIRoute,
  ErrorSchema,
  SuccessSchema,
} from '../../lib/openapi'

// 制約条件一覧取得
export const getConstraintsRoute = createAPIRoute({
  method: 'get',
  path: '/api/constraints',
  tags: ['Constraints'],
  summary: '利用可能な制約条件一覧を取得',
  description:
    'システムに登録されている全ての制約条件の一覧を取得します。各制約条件の設定状態も含まれます。',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              constraints: z.array(ConstraintDefinitionSchema),
              total: z.number().openapi({ example: 4 }),
              enabledCount: z.number().openapi({ example: 3 }),
            }),
          }),
        },
      },
      description: '制約条件一覧の取得に成功',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'サーバーエラー',
    },
  },
})

// 特定制約条件の詳細取得
export const getConstraintDetailRoute = createAPIRoute({
  method: 'get',
  path: '/api/constraints/{constraintId}',
  tags: ['Constraints'],
  summary: '特定制約条件の詳細情報を取得',
  description: '指定されたIDの制約条件の詳細情報を取得します。',
  request: {
    params: z.object({
      constraintId: z.string().openapi({
        param: { name: 'constraintId', in: 'path' },
        example: 'teacher_conflict',
        description: '制約条件ID',
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              constraint: ConstraintDefinitionSchema,
            }),
          }),
        },
      },
      description: '制約条件詳細の取得に成功',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: '制約条件が見つからない',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'サーバーエラー',
    },
  },
})

// 制約条件設定更新
export const updateConstraintSettingsRoute = createAPIRoute({
  method: 'patch',
  path: '/api/constraints/{constraintId}',
  tags: ['Constraints'],
  summary: '制約条件設定を更新',
  description: '指定された制約条件の有効/無効状態やパラメータを更新します。',
  request: {
    params: z.object({
      constraintId: z.string().openapi({
        param: { name: 'constraintId', in: 'path' },
        example: 'teacher_conflict',
        description: '制約条件ID',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            enabled: z.boolean().optional().openapi({
              example: true,
              description: '制約条件の有効/無効',
            }),
            parameters: z
              .record(z.any())
              .optional()
              .openapi({
                example: {
                  strictMode: false,
                  allowPartTime: true,
                },
                description: '制約条件のパラメータ',
              }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessSchema,
        },
      },
      description: '制約条件設定の更新に成功',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'バリデーションエラー',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: '制約条件が見つからない',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'サーバーエラー',
    },
  },
})

// 制約条件検証
export const validateConstraintsRoute = createAPIRoute({
  method: 'post',
  path: '/api/constraints/validate/{timetableId}',
  tags: ['Constraints'],
  summary: '時間割の制約条件を検証',
  description: '指定された時間割データに対して制約条件の検証を実行します。',
  request: {
    params: z.object({
      timetableId: z.string().openapi({
        param: { name: 'timetableId', in: 'path' },
        example: 'tmt_1234567890abcdef',
        description: '時間割ID',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            schedules: z
              .array(
                z.object({
                  classId: z.string().openapi({ example: 'cls_1234567890abcdef' }),
                  subjectId: z.string().openapi({ example: 'sub_1234567890abcdef' }),
                  teacherId: z.string().openapi({ example: 'tch_1234567890abcdef' }),
                  classroomId: z.string().openapi({ example: 'crm_1234567890abcdef' }),
                  dayOfWeek: z
                    .number()
                    .min(1)
                    .max(6)
                    .openapi({ example: 1, description: '曜日（1=月曜日）' }),
                  period: z.number().min(1).max(6).openapi({ example: 1, description: '時限' }),
                })
              )
              .openapi({ description: '検証対象のスケジュール配列' }),
            schoolId: z.string().openapi({
              example: 'sch_1234567890abcdef',
              description: '学校ID',
            }),
            saturdayHours: z.number().min(0).max(8).default(0).openapi({
              example: 0,
              description: '土曜日の授業時間数',
            }),
            enabledConstraints: z
              .array(z.string())
              .optional()
              .openapi({
                example: ['teacher_conflict', 'classroom_conflict'],
                description: '有効にする制約条件ID（指定しない場合は全て）',
              }),
            skipConstraints: z
              .array(z.string())
              .optional()
              .openapi({
                example: ['time_slot_preference'],
                description: 'スキップする制約条件ID',
              }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ConstraintValidationResultSchema,
          }),
        },
      },
      description: '制約検証の実行に成功',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'バリデーションエラー',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'サーバーエラー',
    },
  },
})

// カテゴリ別制約検証
export const validateConstraintsByCategoryRoute = createAPIRoute({
  method: 'post',
  path: '/api/constraints/validate/{timetableId}/category/{category}',
  tags: ['Constraints'],
  summary: 'カテゴリ別制約条件検証',
  description: '指定されたカテゴリの制約条件のみを対象として検証を実行します。',
  request: {
    params: z.object({
      timetableId: z.string().openapi({
        param: { name: 'timetableId', in: 'path' },
        example: 'tmt_1234567890abcdef',
        description: '時間割ID',
      }),
      category: z.enum(['teacher', 'classroom', 'time', 'subject', 'custom']).openapi({
        param: { name: 'category', in: 'path' },
        example: 'teacher',
        description: '制約カテゴリ',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
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
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              category: z.string(),
              isValid: z.boolean(),
              violations: z.array(ConstraintViolationSchema),
            }),
          }),
        },
      },
      description: 'カテゴリ別制約検証の実行に成功',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'バリデーションエラー',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'サーバーエラー',
    },
  },
})

export const constraintRoutes = [
  getConstraintsRoute,
  getConstraintDetailRoute,
  updateConstraintSettingsRoute,
  validateConstraintsRoute,
  validateConstraintsByCategoryRoute,
]
