/**
 * クラス管理API（Drizzle版）
 * 学校内のクラス情報を管理
 */

import { zValidator } from '@hono/zod-validator'
import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { classes, schools } from '../db/schema'
import { createDatabase, type Env } from '../lib/db'
import {
  type CreateClassInput,
  CreateClassSchema,
  type UpdateClassInput,
  UpdateClassSchema,
} from '../lib/validation'

const classesRouter = new Hono<{ Bindings: Env }>()

// クラス一覧取得（学校IDで絞り込み）
classesRouter.get('/', async c => {
  try {
    const schoolId = c.req.query('schoolId')
    const db = createDatabase(c.env)

    let classList
    if (schoolId) {
      classList = await db
        .select({
          id: classes.id,
          name: classes.name,
          grade: classes.grade,
          schoolId: classes.schoolId,
          createdAt: classes.createdAt,
          updatedAt: classes.updatedAt,
          school: {
            id: schools.id,
            name: schools.name,
          },
        })
        .from(classes)
        .leftJoin(schools, eq(classes.schoolId, schools.id))
        .where(eq(classes.schoolId, schoolId))
        .orderBy(asc(classes.grade), asc(classes.name))
    } else {
      classList = await db
        .select({
          id: classes.id,
          name: classes.name,
          grade: classes.grade,
          schoolId: classes.schoolId,
          createdAt: classes.createdAt,
          updatedAt: classes.updatedAt,
          school: {
            id: schools.id,
            name: schools.name,
          },
        })
        .from(classes)
        .leftJoin(schools, eq(classes.schoolId, schools.id))
        .orderBy(asc(classes.grade), asc(classes.name))
    }

    return c.json({
      success: true,
      data: classList,
    })
  } catch (error) {
    console.error('クラス一覧取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_CLASSES_ERROR',
        message: 'クラス一覧の取得に失敗しました',
      },
      500
    )
  }
})

// クラス詳細取得
classesRouter.get('/:id', async c => {
  try {
    const id = c.req.param('id')
    const db = createDatabase(c.env)

    const classData = await db
      .select({
        id: classes.id,
        name: classes.name,
        grade: classes.grade,
        schoolId: classes.schoolId,
        createdAt: classes.createdAt,
        updatedAt: classes.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(classes)
      .leftJoin(schools, eq(classes.schoolId, schools.id))
      .where(eq(classes.id, id))
      .get()

    if (!classData) {
      return c.json(
        {
          error: 'CLASS_NOT_FOUND',
          message: '指定されたクラスが見つかりません',
        },
        404
      )
    }

    return c.json({
      success: true,
      data: classData,
    })
  } catch (error) {
    console.error('クラス詳細取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_CLASS_ERROR',
        message: 'クラス詳細の取得に失敗しました',
      },
      500
    )
  }
})

// クラス作成
classesRouter.post('/', zValidator('json', CreateClassSchema), async c => {
  try {
    const data: CreateClassInput = c.req.valid('json')
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

    // 同じ学校内での重複チェック
    const existingClass = await db
      .select()
      .from(classes)
      .where(and(eq(classes.schoolId, data.schoolId), eq(classes.name, data.name)))
      .get()

    if (existingClass) {
      return c.json(
        {
          error: 'CLASS_ALREADY_EXISTS',
          message: '同じ名前のクラスが既に存在します',
        },
        409
      )
    }

    const newClass = await db.insert(classes).values(data).returning().get()

    // 作成されたクラスに学校情報を含めて返す
    const classWithSchool = await db
      .select({
        id: classes.id,
        name: classes.name,
        grade: classes.grade,
        schoolId: classes.schoolId,
        createdAt: classes.createdAt,
        updatedAt: classes.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(classes)
      .leftJoin(schools, eq(classes.schoolId, schools.id))
      .where(eq(classes.id, newClass.id))
      .get()

    return c.json(
      {
        success: true,
        data: classWithSchool,
      },
      201
    )
  } catch (error) {
    console.error('クラス作成エラー:', error)
    return c.json(
      {
        error: 'CREATE_CLASS_ERROR',
        message: 'クラスの作成に失敗しました',
      },
      500
    )
  }
})

// クラス更新
classesRouter.put('/:id', zValidator('json', UpdateClassSchema), async c => {
  try {
    const id = c.req.param('id')
    const data: UpdateClassInput = c.req.valid('json')
    const db = createDatabase(c.env)

    // クラスの存在確認
    const existingClass = await db.select().from(classes).where(eq(classes.id, id)).get()

    if (!existingClass) {
      return c.json(
        {
          error: 'CLASS_NOT_FOUND',
          message: '指定されたクラスが見つかりません',
        },
        404
      )
    }

    // 名前の重複チェック（名前が変更される場合）
    if (data.name && data.name !== existingClass.name) {
      const duplicateClass = await db
        .select()
        .from(classes)
        .where(
          and(
            eq(classes.schoolId, existingClass.schoolId),
            eq(classes.name, data.name)
          )
        )
        .get()

      if (duplicateClass) {
        return c.json(
          {
            error: 'CLASS_ALREADY_EXISTS',
            message: '同じ名前のクラスが既に存在します',
          },
          409
        )
      }
    }

    const updatedClass = await db
      .update(classes)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(classes.id, id))
      .returning()
      .get()

    // 更新されたクラスに学校情報を含めて返す
    const classWithSchool = await db
      .select({
        id: classes.id,
        name: classes.name,
        grade: classes.grade,
        schoolId: classes.schoolId,
        createdAt: classes.createdAt,
        updatedAt: classes.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(classes)
      .leftJoin(schools, eq(classes.schoolId, schools.id))
      .where(eq(classes.id, updatedClass.id))
      .get()

    return c.json({
      success: true,
      data: classWithSchool,
    })
  } catch (error) {
    console.error('クラス更新エラー:', error)
    return c.json(
      {
        error: 'UPDATE_CLASS_ERROR',
        message: 'クラスの更新に失敗しました',
      },
      500
    )
  }
})

// クラス削除
classesRouter.delete('/:id', async c => {
  try {
    const id = c.req.param('id')
    const db = createDatabase(c.env)

    // クラスの存在確認
    const existingClass = await db.select().from(classes).where(eq(classes.id, id)).get()

    if (!existingClass) {
      return c.json(
        {
          error: 'CLASS_NOT_FOUND',
          message: '指定されたクラスが見つかりません',
        },
        404
      )
    }

    await db.delete(classes).where(eq(classes.id, id))

    return c.json({
      success: true,
      message: 'クラスを削除しました',
    })
  } catch (error) {
    console.error('クラス削除エラー:', error)
    return c.json(
      {
        error: 'DELETE_CLASS_ERROR',
        message: 'クラスの削除に失敗しました',
      },
      500
    )
  }
})

export default classesRouter