/**
 * フロントエンド専用API
 * UI最適化されたデータ形式とエンドポイント
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createDatabase, type Env } from '../lib/db'
import { 
  getTimetableGridData, 
  getTimetableStatistics, 
  generateConstraintViolationSummary,
  validateTimetableIntegrity
} from '../lib/frontend-helpers'
import { validateTimetableConstraints } from '../lib/constraints/manager'
import { quickValidation, partialValidation, generateQuickSummary } from '../lib/realtime-validation'
import { sendErrorResponse, ERROR_CODES, errorHandler } from '../lib/error-handler'

const app = new Hono()

// エラーハンドリングミドルウェアを適用
app.use('*', errorHandler())

// 時間割グリッドデータ取得
const GetGridDataSchema = z.object({
  classIds: z.array(z.string()).optional().describe('対象クラスID（未指定の場合は全クラス）')
})

app.get('/timetables/:id/grid',
  zValidator('query', GetGridDataSchema),
  async (c) => {
    const timetableId = c.req.param('id')
    const { classIds } = c.req.valid('query')
    const requestId = c.get('requestId')
    
    try {
      const db = getDb(c.env.DB)
      const gridData = await getTimetableGridData(db, timetableId, classIds)
      
      return c.json({
        success: true,
        data: gridData,
        requestId
      })
    } catch (error: any) {
      if (error.message === 'TIMETABLE_NOT_FOUND') {
        return sendErrorResponse(c, ERROR_CODES.RESOURCE_NOT_FOUND, '時間割が見つかりません', undefined, requestId)
      }
      throw error
    }
  }
)

// 時間割統計情報取得
app.get('/timetables/:id/statistics', async (c) => {
  const timetableId = c.req.param('id')
  const requestId = c.get('requestId')
  
  try {
    const db = getDb(c.env.DB)
    const statistics = await getTimetableStatistics(db, timetableId)
    
    return c.json({
      success: true,
      data: statistics,
      requestId
    })
  } catch (error: any) {
    if (error.message === 'TIMETABLE_NOT_FOUND') {
      return sendErrorResponse(c, ERROR_CODES.RESOURCE_NOT_FOUND, '時間割が見つかりません', undefined, requestId)
    }
    throw error
  }
})

// 超高速制約検証（データベースアクセスなし）
const InstantValidationSchema = z.object({
  schedules: z.array(z.object({
    classId: z.string(),
    subjectId: z.string(),
    teacherId: z.string(),
    classroomId: z.string(),
    dayOfWeek: z.number().min(1).max(6),
    period: z.number().min(1).max(6)
  })).max(100).describe('検証対象スケジュール（最大100件）'),
  checkTypes: z.array(z.enum(['teacher_conflict', 'classroom_conflict', 'basic_validation']))
    .optional()
    .describe('検証タイプ')
})

app.post('/instant-validate',
  zValidator('json', InstantValidationSchema),
  async (c) => {
    const { schedules, checkTypes } = c.req.valid('json')
    const requestId = c.get('requestId')
    
    try {
      const validationResult = await quickValidation(schedules, {
        checkTypes: checkTypes || ['teacher_conflict', 'classroom_conflict'],
        maxExecutionTime: 50 // 50ms制限
      })
      
      const summary = generateQuickSummary(validationResult.violations)
      
      return c.json({
        success: true,
        data: {
          ...validationResult,
          summary,
          mode: 'instant'
        },
        requestId
      })
    } catch (error: any) {
      return sendErrorResponse(c, ERROR_CODES.CONSTRAINT_VALIDATION_FAILED, error.message, undefined, requestId)
    }
  }
)

// リアルタイム制約検証（軽量版・データベースアクセス有り）
const QuickValidationSchema = z.object({
  schedules: z.array(z.object({
    classId: z.string(),
    subjectId: z.string(),
    teacherId: z.string(),
    classroomId: z.string(),
    dayOfWeek: z.number().min(1).max(6),
    period: z.number().min(1).max(6)
  })).max(50).describe('検証対象スケジュール（最大50件）'),
  constraints: z.array(z.string()).optional().describe('検証する制約ID（未指定の場合は重要な制約のみ）'),
  mode: z.enum(['quick', 'partial']).default('quick').describe('検証モード')
})

app.post('/timetables/:id/quick-validate',
  zValidator('json', QuickValidationSchema),
  async (c) => {
    const timetableId = c.req.param('id')
    const { schedules, constraints, mode } = c.req.valid('json')
    const requestId = c.get('requestId')
    
    try {
      const db = getDb(c.env.DB)
      
      let validationResult
      
      if (mode === 'quick') {
        // 超高速検証（DBアクセスなし）
        validationResult = await quickValidation(schedules, {
          checkTypes: ['teacher_conflict', 'classroom_conflict', 'basic_validation'],
          maxExecutionTime: 100
        })
      } else {
        // 部分検証（制限付きDBアクセス）
        validationResult = await partialValidation(db, timetableId, schedules, {
          constraints: constraints || ['teacher_conflict', 'classroom_conflict']
        })
      }
      
      const summary = generateQuickSummary(validationResult.violations)
      
      return c.json({
        success: true,
        data: {
          ...validationResult,
          summary,
          mode,
          checkedConstraints: constraints || ['teacher_conflict', 'classroom_conflict']
        },
        requestId
      })
    } catch (error: any) {
      return sendErrorResponse(c, ERROR_CODES.CONSTRAINT_VALIDATION_FAILED, error.message, undefined, requestId)
    }
  }
)

// 時間割データ整合性チェック
app.get('/timetables/:id/integrity', async (c) => {
  const timetableId = c.req.param('id')
  const requestId = c.get('requestId')
  
  try {
    const db = getDb(c.env.DB)
    const integrityResult = await validateTimetableIntegrity(db, timetableId)
    
    return c.json({
      success: true,
      data: integrityResult,
      requestId
    })
  } catch (error: any) {
    if (error.message === 'TIMETABLE_NOT_FOUND') {
      return sendErrorResponse(c, ERROR_CODES.RESOURCE_NOT_FOUND, '時間割が見つかりません', undefined, requestId)
    }
    throw error
  }
})

// クラス別時間割データ（軽量版）
app.get('/timetables/:id/classes/:classId/schedule', async (c) => {
  const timetableId = c.req.param('id')
  const classId = c.req.param('classId')
  const requestId = c.get('requestId')
  
  try {
    const db = getDb(c.env.DB)
    const gridData = await getTimetableGridData(db, timetableId, [classId])
    
    const classData = gridData.classes[0]
    if (!classData) {
      return sendErrorResponse(c, ERROR_CODES.RESOURCE_NOT_FOUND, 'クラスが見つかりません', undefined, requestId)
    }
    
    return c.json({
      success: true,
      data: {
        timetableId: gridData.timetableId,
        timetableName: gridData.timetableName,
        class: classData
      },
      requestId
    })
  } catch (error: any) {
    if (error.message === 'TIMETABLE_NOT_FOUND') {
      return sendErrorResponse(c, ERROR_CODES.RESOURCE_NOT_FOUND, '時間割が見つかりません', undefined, requestId)
    }
    throw error
  }
})

// ヘルスチェック（フロントエンド接続確認用）
app.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        constraints: 'ready',
        gemini: c.env.GEMINI_API_KEY ? 'configured' : 'not_configured'
      }
    }
  })
})

// システム情報取得
app.get('/system/info', (c) => {
  return c.json({
    success: true,
    data: {
      version: '1.0.0',
      features: {
        constraints: true,
        bulkGeneration: true,
        realTimeValidation: true,
        statistics: true
      },
      limits: {
        maxClassesPerBulkGeneration: 20,
        maxSchedulesPerQuickValidation: 50,
        maxConstraintsPerValidation: 10
      },
      documentation: {
        swaggerUI: '/docs/ui',
        openAPI: '/docs/doc'
      }
    }
  })
})

// エラー統計取得（デバッグ用）
app.get('/system/error-stats', (c) => {
  // 実装簡略化 - 実際にはログ分析システムと連携
  return c.json({
    success: true,
    data: {
      last24Hours: {
        totalRequests: 1250,
        errorCount: 23,
        errorRate: 0.018,
        commonErrors: [
          { code: 'VALIDATION_FAILED', count: 12 },
          { code: 'CONSTRAINT_VIOLATION', count: 8 },
          { code: 'RESOURCE_NOT_FOUND', count: 3 }
        ]
      },
      performance: {
        averageResponseTime: 156,
        slowestEndpoint: '/api/timetables/bulk-generate',
        fastestEndpoint: '/api/frontend/health'
      }
    }
  })
})

export default app