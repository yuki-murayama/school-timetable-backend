/**
 * 学校管理API（Drizzle版）
 * CRUD操作を提供（認証・認可機能付き）
 */

import { zValidator } from '@hono/zod-validator'
import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { schools } from '../db/schema'
import {
  jwtAuth,
  requirePermission,
  requireSchoolAccess,
  superAdminOnly,
} from '../lib/auth-middleware'
import { createDatabase, type Env } from '../lib/db'
import { ERROR_CODES, errorHandler, sendErrorResponse } from '../lib/error-handler'
import {
  type CreateSchoolInput,
  CreateSchoolSchema,
  type UpdateSchoolInput,
  UpdateSchoolSchema,
} from '../lib/validation'

const schoolsRouter = new Hono<{ Bindings: Env }>()

// 認証ミドルウェアを適用
schoolsRouter.use('*', errorHandler())
schoolsRouter.use('*', jwtAuth({ allowMock: true }))

// 学校一覧取得（読み取り権限が必要）
schoolsRouter.get('/', requirePermission('schools:read'), async c => {
  const requestId = c.get('requestId')
  const authContext = c.get('authContext')

  try {
    const db = createDatabase(c.env)

    // スーパー管理者は全学校を取得、その他は所属学校のみ
    let schoolList
    if (authContext?.role === 'super_admin') {
      schoolList = await db.select().from(schools).orderBy(desc(schools.createdAt))
    } else if (authContext?.schoolId) {
      schoolList = await db
        .select()
        .from(schools)
        .where(eq(schools.id, authContext.schoolId))
        .orderBy(desc(schools.createdAt))
    } else {
      schoolList = []
    }

    return c.json({
      success: true,
      data: schoolList,
      requestId,
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
  }
})

// 学校詳細取得（アクセス権限チェック付き）
schoolsRouter.get('/:id', requirePermission('schools:read'), requireSchoolAccess(), async c => {
  const requestId = c.get('requestId')

  try {
    const id = c.req.param('id')
    const db = createDatabase(c.env)

    const school = await db.select().from(schools).where(eq(schools.id, id)).get()

    if (!school) {
      return sendErrorResponse(
        c,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '指定された学校が見つかりません',
        { schoolId: id },
        requestId
      )
    }

    return c.json({
      success: true,
      data: school,
      requestId,
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
  }
})

// 学校作成（スーパー管理者のみ）
schoolsRouter.post('/', superAdminOnly(), zValidator('json', CreateSchoolSchema), async c => {
  const requestId = c.get('requestId')

  try {
    const data: CreateSchoolInput = c.req.valid('json')
    const db = createDatabase(c.env)

    const newSchool = await db.insert(schools).values(data).returning().get()

    return c.json(
      {
        success: true,
        data: newSchool,
        requestId,
      },
      201
    )
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
  }
})

// 学校更新（書き込み権限とアクセス権限が必要）
schoolsRouter.put(
  '/:id',
  requirePermission('schools:write'),
  requireSchoolAccess(),
  zValidator('json', UpdateSchoolSchema),
  async c => {
    const requestId = c.get('requestId')

    try {
      const id = c.req.param('id')
      const data: UpdateSchoolInput = c.req.valid('json')
      const db = createDatabase(c.env)

      // 学校の存在確認
      const existingSchool = await db.select().from(schools).where(eq(schools.id, id)).get()

      if (!existingSchool) {
        return sendErrorResponse(
          c,
          ERROR_CODES.RESOURCE_NOT_FOUND,
          '指定された学校が見つかりません',
          { schoolId: id },
          requestId
        )
      }

      const updatedSchool = await db
        .update(schools)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(schools.id, id))
        .returning()
        .get()

      return c.json({
        success: true,
        data: updatedSchool,
      })
    } catch (error) {
      console.error('学校更新エラー:', error)
      return c.json(
        {
          error: 'UPDATE_SCHOOL_ERROR',
          message: '学校の更新に失敗しました',
        },
        500
      )
    }
  }
)

// 学校削除
schoolsRouter.delete('/:id', async c => {
  try {
    const id = c.req.param('id')
    const db = createDatabase(c.env)

    // 学校の存在確認
    const existingSchool = await db.select().from(schools).where(eq(schools.id, id)).get()

    if (!existingSchool) {
      return c.json(
        {
          error: 'SCHOOL_NOT_FOUND',
          message: '指定された学校が見つかりません',
        },
        404
      )
    }

    await db.delete(schools).where(eq(schools.id, id))

    return c.json({
      success: true,
      message: '学校を削除しました',
    })
  } catch (error) {
    console.error('学校削除エラー:', error)
    return c.json(
      {
        error: 'DELETE_SCHOOL_ERROR',
        message: '学校の削除に失敗しました',
      },
      500
    )
  }
})

export default schoolsRouter
