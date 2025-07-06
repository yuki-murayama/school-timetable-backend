/**
 * データベース管理API
 * スキーマ完全化後の管理・メンテナンス機能
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createDatabase, type Env } from '../lib/db'
import {
  getDatabaseStatistics,
  validateSchoolDataIntegrity,
  createTimetableSnapshot,
  updateSchoolConstraintSettings,
  logTimetableGeneration,
  getSystemSetting,
  setSystemSetting,
  cleanupOldData,
  grantSchoolAccess,
  analyzePerformance
} from '../lib/database-helpers'
import { sendErrorResponse, ERROR_CODES, errorHandler } from '../lib/error-handler'

const app = new Hono()
app.use('*', errorHandler())

// データベース統計情報取得
app.get('/statistics', async (c) => {
  const requestId = c.get('requestId')
  
  try {
    const db = getDb(c.env.DB)
    const stats = await getDatabaseStatistics(db)
    
    return c.json({
      success: true,
      data: stats,
      requestId
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.DATABASE_ERROR, error.message, undefined, requestId)
  }
})

// 学校データ整合性チェック
app.get('/schools/:schoolId/integrity', async (c) => {
  const schoolId = c.req.param('schoolId')
  const requestId = c.get('requestId')
  
  try {
    const db = getDb(c.env.DB)
    const result = await validateSchoolDataIntegrity(db, schoolId)
    
    return c.json({
      success: true,
      data: result,
      requestId
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.DATABASE_ERROR, error.message, undefined, requestId)
  }
})

// 時間割スナップショット作成
const CreateSnapshotSchema = z.object({
  changeType: z.enum(['created', 'updated', 'approved', 'archived']),
  changeDescription: z.string().min(1, '変更内容の説明は必須です'),
  changedBy: z.string().min(1, '変更者IDは必須です')
})

app.post('/timetables/:timetableId/snapshot',
  zValidator('json', CreateSnapshotSchema),
  async (c) => {
    const timetableId = c.req.param('timetableId')
    const { changeType, changeDescription, changedBy } = c.req.valid('json')
    const requestId = c.get('requestId')
    
    try {
      const db = getDb(c.env.DB)
      await createTimetableSnapshot(db, timetableId, changeType, changeDescription, changedBy)
      
      return c.json({
        success: true,
        message: '時間割スナップショットを作成しました',
        requestId
      })
    } catch (error: any) {
      if (error.message === '時間割が見つかりません') {
        return sendErrorResponse(c, ERROR_CODES.RESOURCE_NOT_FOUND, error.message, undefined, requestId)
      }
      return sendErrorResponse(c, ERROR_CODES.DATABASE_ERROR, error.message, undefined, requestId)
    }
  }
)

// 制約設定管理
const UpdateConstraintSettingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  priority: z.number().min(1).max(10).optional(),
  parameters: z.record(z.any()).optional(),
  updatedBy: z.string().min(1, '更新者IDは必須です')
})

app.put('/schools/:schoolId/constraints/:constraintType',
  zValidator('json', UpdateConstraintSettingsSchema),
  async (c) => {
    const schoolId = c.req.param('schoolId')
    const constraintType = c.req.param('constraintType')
    const { updatedBy, ...settings } = c.req.valid('json')
    const requestId = c.get('requestId')
    
    try {
      const db = getDb(c.env.DB)
      await updateSchoolConstraintSettings(db, schoolId, constraintType, settings, updatedBy)
      
      return c.json({
        success: true,
        message: '制約設定を更新しました',
        requestId
      })
    } catch (error: any) {
      return sendErrorResponse(c, ERROR_CODES.DATABASE_ERROR, error.message, undefined, requestId)
    }
  }
)

// システム設定取得
app.get('/system/settings/:key', async (c) => {
  const key = c.req.param('key')
  const requestId = c.get('requestId')
  
  try {
    const db = getDb(c.env.DB)
    const value = await getSystemSetting(db, key)
    
    if (value === undefined) {
      return sendErrorResponse(c, ERROR_CODES.RESOURCE_NOT_FOUND, 'システム設定が見つかりません', undefined, requestId)
    }
    
    return c.json({
      success: true,
      data: { key, value },
      requestId
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.DATABASE_ERROR, error.message, undefined, requestId)
  }
})

// システム設定更新
const SetSystemSettingSchema = z.object({
  value: z.any(),
  description: z.string().optional(),
  category: z.string().optional(),
  isPublic: z.boolean().optional(),
  updatedBy: z.string().optional()
})

app.put('/system/settings/:key',
  zValidator('json', SetSystemSettingSchema),
  async (c) => {
    const key = c.req.param('key')
    const settings = c.req.valid('json')
    const requestId = c.get('requestId')
    
    try {
      const db = getDb(c.env.DB)
      await setSystemSetting(db, key, settings.value, {
        description: settings.description,
        category: settings.category,
        isPublic: settings.isPublic,
        updatedBy: settings.updatedBy
      })
      
      return c.json({
        success: true,
        message: 'システム設定を更新しました',
        requestId
      })
    } catch (error: any) {
      return sendErrorResponse(c, ERROR_CODES.DATABASE_ERROR, error.message, undefined, requestId)
    }
  }
)

// データベースクリーンアップ
const CleanupSchema = z.object({
  olderThanDays: z.number().min(1).max(3650).default(365),
  dryRun: z.boolean().default(true)
})

app.post('/cleanup',
  zValidator('json', CleanupSchema),
  async (c) => {
    const { olderThanDays, dryRun } = c.req.valid('json')
    const requestId = c.get('requestId')
    
    try {
      const db = getDb(c.env.DB)
      const result = await cleanupOldData(db, { olderThanDays, dryRun })
      
      return c.json({
        success: true,
        data: result,
        message: dryRun ? 'クリーンアップ対象を確認しました（実行されていません）' : 'クリーンアップを実行しました',
        requestId
      })
    } catch (error: any) {
      return sendErrorResponse(c, ERROR_CODES.DATABASE_ERROR, error.message, undefined, requestId)
    }
  }
)

// ユーザー学校アクセス権限管理
const GrantAccessSchema = z.object({
  userId: z.string().min(1, 'ユーザーIDは必須です'),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer')
})

app.post('/schools/:schoolId/access',
  zValidator('json', GrantAccessSchema),
  async (c) => {
    const schoolId = c.req.param('schoolId')
    const { userId, role } = c.req.valid('json')
    const requestId = c.get('requestId')
    
    try {
      const db = getDb(c.env.DB)
      await grantSchoolAccess(db, userId, schoolId, role)
      
      return c.json({
        success: true,
        message: 'アクセス権限を設定しました',
        requestId
      })
    } catch (error: any) {
      return sendErrorResponse(c, ERROR_CODES.DATABASE_ERROR, error.message, undefined, requestId)
    }
  }
)

// パフォーマンス分析
app.get('/performance', async (c) => {
  const requestId = c.get('requestId')
  
  try {
    const db = getDb(c.env.DB)
    const analysis = await analyzePerformance(db)
    
    return c.json({
      success: true,
      data: analysis,
      requestId
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.DATABASE_ERROR, error.message, undefined, requestId)
  }
})

// 生成ログ記録（内部API）
const LogGenerationSchema = z.object({
  timetableId: z.string(),
  generationType: z.enum(['single', 'bulk', 'manual']),
  status: z.enum(['started', 'completed', 'failed']),
  targetClasses: z.array(z.string()).optional(),
  generationTime: z.number().optional(),
  errorMessage: z.string().optional(),
  constraintViolations: z.array(z.any()).optional(),
  requestedBy: z.string().optional()
})

app.post('/generation-logs',
  zValidator('json', LogGenerationSchema),
  async (c) => {
    const data = c.req.valid('json')
    const requestId = c.get('requestId')
    
    try {
      const db = getDb(c.env.DB)
      await logTimetableGeneration(db, data)
      
      return c.json({
        success: true,
        message: '生成ログを記録しました',
        requestId
      })
    } catch (error: any) {
      return sendErrorResponse(c, ERROR_CODES.DATABASE_ERROR, error.message, undefined, requestId)
    }
  }
)

// ヘルスチェック（データベース接続確認）
app.get('/health', async (c) => {
  const requestId = c.get('requestId')
  
  try {
    const db = getDb(c.env.DB)
    const stats = await getDatabaseStatistics(db)
    
    return c.json({
      success: true,
      data: {
        status: 'healthy',
        database: 'connected',
        totalRecords: Object.values(stats).reduce((sum, count) => sum + count, 0),
        timestamp: new Date().toISOString()
      },
      requestId
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.DATABASE_ERROR, 'データベース接続に失敗しました', undefined, requestId)
  }
})

export default app