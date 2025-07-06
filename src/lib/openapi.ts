/**
 * OpenAPI スキーマ定義
 * Swagger UI 用のAPIドキュメント生成
 */

import { swaggerUI } from '@hono/swagger-ui'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { Env } from './db'

// OpenAPI アプリケーションの作成
export const createOpenAPIApp = () => {
  const app = new OpenAPIHono<{ Bindings: Env }>()

  // OpenAPI ドキュメント設定
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'School Timetable API',
      description: '学校時間割作成システムのバックエンドAPI',
      contact: {
        name: 'API Support',
        email: 'support@school-timetable.com',
      },
    },
    servers: [
      {
        url: 'https://school-timetable-backend.malah-shunmu.workers.dev',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Schools', description: '学校管理' },
      { name: 'Classes', description: 'クラス管理' },
      { name: 'Teachers', description: '教師管理' },
      { name: 'Subjects', description: '教科管理' },
      { name: 'Classrooms', description: '教室管理' },
      { name: 'Timetables', description: '時間割管理' },
      { name: 'Constraints', description: '制約条件管理' },
      { name: 'Test', description: 'テスト用エンドポイント' },
    ],
  })

  // Swagger UI の設定
  app.get('/ui', swaggerUI({ url: '/doc' }))

  return app
}

// 共通スキーマ定義
export const ErrorSchema = z.object({
  error: z.string().openapi({ example: 'VALIDATION_FAILED' }),
  message: z.string().openapi({ example: 'バリデーションエラーが発生しました' }),
  details: z
    .array(z.string())
    .optional()
    .openapi({ example: ['名前は必須です'] }),
})

export const SuccessSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: z.any().optional(),
  message: z.string().optional().openapi({ example: '正常に処理されました' }),
})

// 学校関連スキーマ
export const SchoolSchema = z.object({
  id: z.string().openapi({ example: 'sch_1234567890abcdef' }),
  name: z.string().openapi({ example: '東京都立第一中学校' }),
  createdAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
})

export const CreateSchoolSchema = z.object({
  name: z.string().min(1, '学校名は必須です').openapi({ example: '東京都立第一中学校' }),
})

// クラス関連スキーマ
export const ClassSchema = z.object({
  id: z.string().openapi({ example: 'cls_1234567890abcdef' }),
  name: z.string().openapi({ example: '1年A組' }),
  grade: z.number().int().min(1).max(6).openapi({ example: 1 }),
  schoolId: z.string().openapi({ example: 'sch_1234567890abcdef' }),
  createdAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
})

export const CreateClassSchema = z.object({
  name: z.string().min(1, 'クラス名は必須です').openapi({ example: '1年A組' }),
  grade: z.number().int().min(1).max(6).openapi({ example: 1 }),
  schoolId: z.string().min(1, '学校IDは必須です').openapi({ example: 'sch_1234567890abcdef' }),
})

// 教師関連スキーマ
export const TeacherSchema = z.object({
  id: z.string().openapi({ example: 'tch_1234567890abcdef' }),
  name: z.string().openapi({ example: '山田太郎' }),
  schoolId: z.string().openapi({ example: 'sch_1234567890abcdef' }),
  createdAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
})

export const CreateTeacherSchema = z.object({
  name: z.string().min(1, '教師名は必須です').openapi({ example: '山田太郎' }),
  schoolId: z.string().min(1, '学校IDは必須です').openapi({ example: 'sch_1234567890abcdef' }),
})

// 制約条件関連スキーマ
export const ConstraintDefinitionSchema = z.object({
  id: z.string().openapi({ example: 'teacher_conflict' }),
  name: z.string().openapi({ example: '教師時間重複禁止' }),
  description: z
    .string()
    .openapi({ example: '同一教師が同一時間に複数のクラスを担当することを禁止します' }),
  category: z
    .enum(['teacher', 'classroom', 'time', 'subject', 'custom'])
    .openapi({ example: 'teacher' }),
  enabled: z.boolean().openapi({ example: true }),
  priority: z.number().int().min(1).max(10).openapi({ example: 10 }),
  parameters: z.record(z.any()).optional(),
  applicableSchoolTypes: z
    .array(z.string())
    .optional()
    .openapi({ example: ['小学校', '中学校', '高校'] }),
  version: z.string().openapi({ example: '1.0.0' }),
})

export const ConstraintViolationSchema = z.object({
  code: z.string().openapi({ example: 'teacher_conflict_TIME_CONFLICT' }),
  message: z
    .string()
    .openapi({
      example: '教師「山田太郎」が 1曜日 1時限に複数クラス（1年A組、1年B組）を担当しています',
    }),
  severity: z.enum(['error', 'warning', 'info']).openapi({ example: 'error' }),
  affectedSchedules: z.array(
    z.object({
      classId: z.string(),
      dayOfWeek: z.number(),
      period: z.number(),
      teacherId: z.string().optional(),
      classroomId: z.string().optional(),
      subjectId: z.string().optional(),
    })
  ),
  metadata: z.record(z.any()).optional(),
})

export const ConstraintValidationResultSchema = z.object({
  isValid: z.boolean().openapi({ example: false }),
  violations: z.array(ConstraintViolationSchema),
  summary: z
    .object({
      totalConstraints: z.number().openapi({ example: 4 }),
      appliedConstraints: z.number().openapi({ example: 3 }),
      executionTime: z.number().openapi({ example: 15.6 }),
      violationsBySeverity: z.object({
        error: z.number().openapi({ example: 2 }),
        warning: z.number().openapi({ example: 1 }),
        info: z.number().openapi({ example: 0 }),
      }),
    })
    .optional(),
})

// バルク時間割生成スキーマ
export const BulkGenerateRequestSchema = z.object({
  classIds: z
    .array(z.string())
    .min(1, '対象クラスIDは必須です')
    .openapi({
      example: ['cls_1234567890abcdef', 'cls_abcdef1234567890'],
      description: '生成対象のクラスID配列',
    }),
  globalConstraints: z
    .object({
      teacherConflictCheck: z.boolean().default(true).openapi({ example: true }),
      classroomConflictCheck: z.boolean().default(true).openapi({ example: true }),
      subjectDistribution: z
        .enum(['balanced', 'concentrated', 'flexible'])
        .default('balanced')
        .openapi({ example: 'balanced' }),
    })
    .optional(),
  requirements: z.string().optional().openapi({
    example: '体育は午前中に配置してください',
    description: '追加の特別要求事項',
  }),
  priority: z
    .enum(['speed', 'quality', 'balanced'])
    .default('balanced')
    .openapi({ example: 'balanced' }),
})

// 共通レスポンススキーマ
export const PaginationSchema = z.object({
  page: z.number().int().min(1).openapi({ example: 1 }),
  limit: z.number().int().min(1).max(100).openapi({ example: 20 }),
  total: z.number().int().min(0).openapi({ example: 150 }),
  totalPages: z.number().int().min(0).openapi({ example: 8 }),
})

// OpenAPI ルート作成ヘルパー
export const createAPIRoute = createRoute
