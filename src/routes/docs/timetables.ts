/**
 * 時間割API OpenAPI ドキュメント定義
 */

import { createRoute, z } from '@hono/zod-openapi'
import {
  BulkGenerateRequestSchema,
  createAPIRoute,
  ErrorSchema,
  PaginationSchema,
  SuccessSchema,
} from '../../lib/openapi'

// 時間割スキーマ
const TimetableSchema = z.object({
  id: z.string().openapi({ example: 'tmt_1234567890abcdef' }),
  name: z.string().openapi({ example: '2024年度春学期時間割' }),
  schoolId: z.string().openapi({ example: 'sch_1234567890abcdef' }),
  isActive: z.boolean().openapi({ example: true }),
  saturdayHours: z.number().int().min(0).max(8).openapi({ example: 0 }),
  createdAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  school: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
})

const CreateTimetableSchema = z.object({
  name: z.string().min(1, '時間割名は必須です').openapi({ example: '2024年度春学期時間割' }),
  schoolId: z.string().min(1, '学校IDは必須です').openapi({ example: 'sch_1234567890abcdef' }),
  saturdayHours: z.number().int().min(0).max(8).default(0).openapi({ example: 0 }),
})

const ScheduleSchema = z.object({
  id: z.string().openapi({ example: 'sch_1234567890abcdef' }),
  timetableId: z.string().openapi({ example: 'tmt_1234567890abcdef' }),
  classId: z.string().openapi({ example: 'cls_1234567890abcdef' }),
  subjectId: z.string().openapi({ example: 'sub_1234567890abcdef' }),
  teacherId: z.string().openapi({ example: 'tch_1234567890abcdef' }),
  classroomId: z.string().openapi({ example: 'crm_1234567890abcdef' }),
  dayOfWeek: z.number().int().min(1).max(6).openapi({ example: 1 }),
  period: z.number().int().min(1).max(6).openapi({ example: 1 }),
  createdAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
})

// 時間割一覧取得
export const getTimetablesRoute = createAPIRoute({
  method: 'get',
  path: '/api/timetables',
  tags: ['Timetables'],
  summary: '時間割一覧を取得',
  description: 'システムに登録されている時間割の一覧を取得します。学校IDでフィルタリング可能です。',
  request: {
    query: z.object({
      schoolId: z.string().optional().openapi({
        example: 'sch_1234567890abcdef',
        description: '学校IDでフィルタリング',
      }),
      page: z.string().optional().openapi({ example: '1' }),
      limit: z.string().optional().openapi({ example: '20' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              timetables: z.array(TimetableSchema),
              pagination: PaginationSchema.optional(),
            }),
          }),
        },
      },
      description: '時間割一覧の取得に成功',
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

// 時間割作成
export const createTimetableRoute = createAPIRoute({
  method: 'post',
  path: '/api/timetables',
  tags: ['Timetables'],
  summary: '新しい時間割を作成',
  description: '指定された学校に新しい時間割を作成します。',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTimetableSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: TimetableSchema,
          }),
        },
      },
      description: '時間割の作成に成功',
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

// バルク時間割生成
export const bulkGenerateTimetableRoute = createAPIRoute({
  method: 'post',
  path: '/api/timetables/{id}/bulk-generate',
  tags: ['Timetables'],
  summary: 'バルク時間割生成',
  description:
    '複数クラスの時間割を一括生成します。AIを使用して制約条件を満たす時間割を自動生成します。',
  request: {
    params: z.object({
      id: z.string().openapi({
        param: { name: 'id', in: 'path' },
        example: 'tmt_1234567890abcdef',
        description: '時間割ID',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: BulkGenerateRequestSchema,
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
              timetableId: z.string().openapi({ example: 'tmt_1234567890abcdef' }),
              classIds: z.array(z.string()).openapi({
                example: ['cls_1234567890abcdef', 'cls_abcdef1234567890'],
              }),
              totalSlotsCreated: z.number().openapi({ example: 60 }),
              slotsPerClass: z.record(z.number()).openapi({
                example: {
                  cls_1234567890abcdef: 30,
                  cls_abcdef1234567890: 30,
                },
              }),
              message: z.string().openapi({ example: '2クラスの時間割生成が完了しました' }),
            }),
          }),
        },
      },
      description: 'バルク時間割生成に成功',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'バリデーションエラー',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'APIキーエラー',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: '時間割またはクラスが見つからない',
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

// クラス時間割取得
export const getClassTimetableRoute = createAPIRoute({
  method: 'get',
  path: '/api/timetables/{id}/slots/{classId}',
  tags: ['Timetables'],
  summary: 'クラス時間割を取得',
  description: '指定されたクラスの時間割スケジュールを取得します。',
  request: {
    params: z.object({
      id: z.string().openapi({
        param: { name: 'id', in: 'path' },
        example: 'tmt_1234567890abcdef',
        description: '時間割ID',
      }),
      classId: z.string().openapi({
        param: { name: 'classId', in: 'path' },
        example: 'cls_1234567890abcdef',
        description: 'クラスID',
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
              timetableId: z.string(),
              classId: z.string(),
              className: z.string().openapi({ example: '1年A組' }),
              schedules: z.array(
                ScheduleSchema.extend({
                  subject: z.object({ id: z.string(), name: z.string() }).optional(),
                  teacher: z.object({ id: z.string(), name: z.string() }).optional(),
                  classroom: z
                    .object({ id: z.string(), name: z.string(), type: z.string() })
                    .optional(),
                })
              ),
            }),
          }),
        },
      },
      description: 'クラス時間割の取得に成功',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: '時間割またはクラスが見つからない',
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

export const timetableRoutes = [
  getTimetablesRoute,
  createTimetableRoute,
  bulkGenerateTimetableRoute,
  getClassTimetableRoute,
]
