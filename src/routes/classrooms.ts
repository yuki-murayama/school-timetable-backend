/**
 * 教室管理API（Drizzle版）
 * 学校内の教室情報を管理
 */

import { zValidator } from '@hono/zod-validator'
import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { classrooms, schools } from '../db/schema'
import { createDatabase, type Env } from '../lib/db'
import {
  type CreateClassroomInput,
  CreateClassroomSchema,
  type UpdateClassroomInput,
  UpdateClassroomSchema,
} from '../lib/validation'

const classroomsRouter = new Hono<{ Bindings: Env }>()

// 教室一覧取得（学校IDで絞り込み）
classroomsRouter.get('/', async c => {
  try {
    const schoolId = c.req.query('schoolId')
    const type = c.req.query('type') // 教室タイプでフィルタ
    const db = createDatabase(c.env)

    let query = db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        type: classrooms.type,
        capacity: classrooms.capacity,
        schoolId: classrooms.schoolId,
        createdAt: classrooms.createdAt,
        updatedAt: classrooms.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(classrooms)
      .leftJoin(schools, eq(classrooms.schoolId, schools.id))

    const conditions = []
    if (schoolId) {
      conditions.push(eq(classrooms.schoolId, schoolId))
    }
    if (type) {
      conditions.push(eq(classrooms.type, type))
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions))
    }

    const classroomsList = await query.orderBy(asc(classrooms.type), asc(classrooms.name))

    return c.json({
      success: true,
      data: classroomsList,
    })
  } catch (error) {
    console.error('教室一覧取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_CLASSROOMS_ERROR',
        message: '教室一覧の取得に失敗しました',
      },
      500
    )
  }
})

// 教室詳細取得
classroomsRouter.get('/:id', async c => {
  try {
    const id = c.req.param('id')
    const db = createDatabase(c.env)

    const classroomData = await db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        type: classrooms.type,
        capacity: classrooms.capacity,
        schoolId: classrooms.schoolId,
        createdAt: classrooms.createdAt,
        updatedAt: classrooms.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(classrooms)
      .leftJoin(schools, eq(classrooms.schoolId, schools.id))
      .where(eq(classrooms.id, id))
      .get()

    if (!classroomData) {
      return c.json(
        {
          error: 'CLASSROOM_NOT_FOUND',
          message: '指定された教室が見つかりません',
        },
        404
      )
    }

    return c.json({
      success: true,
      data: classroomData,
    })
  } catch (error) {
    console.error('教室詳細取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_CLASSROOM_ERROR',
        message: '教室詳細の取得に失敗しました',
      },
      500
    )
  }
})

// 教室作成
classroomsRouter.post('/', zValidator('json', CreateClassroomSchema), async c => {
  try {
    const data: CreateClassroomInput = c.req.valid('json')
    const db = createDatabase(c.env)

    // 学校の存在確認
    const school = await db.select().from(schools).where(eq(schools.id, data.schoolId)).get()

    if (!school) {
      return c.json(
        {
          error: 'SCHOOL_NOT_FOUND',
          message: '指定された学校が見つかりません',
        },
        404
      )
    }

    // 同じ学校内での重複チェック（名前とタイプの組み合わせ）
    const existingClassroom = await db
      .select()
      .from(classrooms)
      .where(
        and(
          eq(classrooms.schoolId, data.schoolId),
          eq(classrooms.name, data.name),
          eq(classrooms.type, data.type)
        )
      )
      .get()

    if (existingClassroom) {
      return c.json(
        {
          error: 'CLASSROOM_ALREADY_EXISTS',
          message: '同じ名前・タイプの教室が既に存在します',
        },
        409
      )
    }

    const newClassroom = await db.insert(classrooms).values(data).returning().get()

    // 作成された教室に学校情報を含めて返す
    const classroomWithSchool = await db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        type: classrooms.type,
        capacity: classrooms.capacity,
        schoolId: classrooms.schoolId,
        createdAt: classrooms.createdAt,
        updatedAt: classrooms.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(classrooms)
      .leftJoin(schools, eq(classrooms.schoolId, schools.id))
      .where(eq(classrooms.id, newClassroom.id))
      .get()

    return c.json(
      {
        success: true,
        data: classroomWithSchool,
      },
      201
    )
  } catch (error) {
    console.error('教室作成エラー:', error)
    return c.json(
      {
        error: 'CREATE_CLASSROOM_ERROR',
        message: '教室の作成に失敗しました',
      },
      500
    )
  }
})

// 教室更新
classroomsRouter.put('/:id', zValidator('json', UpdateClassroomSchema), async c => {
  try {
    const id = c.req.param('id')
    const data: UpdateClassroomInput = c.req.valid('json')
    const db = createDatabase(c.env)

    // 教室の存在確認
    const existingClassroom = await db.select().from(classrooms).where(eq(classrooms.id, id)).get()

    if (!existingClassroom) {
      return c.json(
        {
          error: 'CLASSROOM_NOT_FOUND',
          message: '指定された教室が見つかりません',
        },
        404
      )
    }

    // 名前またはタイプの重複チェック（変更される場合）
    if (
      (data.name && data.name !== existingClassroom.name) ||
      (data.type && data.type !== existingClassroom.type)
    ) {
      const checkName = data.name || existingClassroom.name
      const checkType = data.type || existingClassroom.type

      const duplicateClassroom = await db
        .select()
        .from(classrooms)
        .where(
          and(
            eq(classrooms.schoolId, existingClassroom.schoolId),
            eq(classrooms.name, checkName),
            eq(classrooms.type, checkType)
          )
        )
        .get()

      if (duplicateClassroom) {
        return c.json(
          {
            error: 'CLASSROOM_ALREADY_EXISTS',
            message: '同じ名前・タイプの教室が既に存在します',
          },
          409
        )
      }
    }

    const updatedClassroom = await db
      .update(classrooms)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(classrooms.id, id))
      .returning()
      .get()

    // 更新された教室に学校情報を含めて返す
    const classroomWithSchool = await db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        type: classrooms.type,
        capacity: classrooms.capacity,
        schoolId: classrooms.schoolId,
        createdAt: classrooms.createdAt,
        updatedAt: classrooms.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(classrooms)
      .leftJoin(schools, eq(classrooms.schoolId, schools.id))
      .where(eq(classrooms.id, updatedClassroom.id))
      .get()

    return c.json({
      success: true,
      data: classroomWithSchool,
    })
  } catch (error) {
    console.error('教室更新エラー:', error)
    return c.json(
      {
        error: 'UPDATE_CLASSROOM_ERROR',
        message: '教室の更新に失敗しました',
      },
      500
    )
  }
})

// 教室削除
classroomsRouter.delete('/:id', async c => {
  try {
    const id = c.req.param('id')
    const db = createDatabase(c.env)

    // 教室の存在確認
    const existingClassroom = await db.select().from(classrooms).where(eq(classrooms.id, id)).get()

    if (!existingClassroom) {
      return c.json(
        {
          error: 'CLASSROOM_NOT_FOUND',
          message: '指定された教室が見つかりません',
        },
        404
      )
    }

    // カスケード削除により、関連するテーブルも自動削除される
    await db.delete(classrooms).where(eq(classrooms.id, id))

    return c.json({
      success: true,
      message: '教室を削除しました',
    })
  } catch (error) {
    console.error('教室削除エラー:', error)
    return c.json(
      {
        error: 'DELETE_CLASSROOM_ERROR',
        message: '教室の削除に失敗しました',
      },
      500
    )
  }
})

export default classroomsRouter
