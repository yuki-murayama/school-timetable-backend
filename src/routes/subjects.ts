/**
 * 教科管理API（Drizzle版）
 * 学校内の教科情報を管理
 */

import { zValidator } from '@hono/zod-validator'
import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { schools, subjects } from '../db/schema'
import { createDatabase, type Env } from '../lib/db'
import {
  type CreateSubjectInput,
  CreateSubjectSchema,
  type UpdateSubjectInput,
  UpdateSubjectSchema,
} from '../lib/validation'

const subjectsRouter = new Hono<{ Bindings: Env }>()

// 教科一覧取得（学校IDで絞り込み）
subjectsRouter.get('/', async c => {
  try {
    const schoolId = c.req.query('schoolId')
    const db = createDatabase(c.env)

    let subjectsList
    if (schoolId) {
      subjectsList = await db
        .select({
          id: subjects.id,
          name: subjects.name,
          schoolId: subjects.schoolId,
          createdAt: subjects.createdAt,
          updatedAt: subjects.updatedAt,
          school: {
            id: schools.id,
            name: schools.name,
          },
        })
        .from(subjects)
        .leftJoin(schools, eq(subjects.schoolId, schools.id))
        .where(eq(subjects.schoolId, schoolId))
        .orderBy(asc(subjects.name))
    } else {
      subjectsList = await db
        .select({
          id: subjects.id,
          name: subjects.name,
          schoolId: subjects.schoolId,
          createdAt: subjects.createdAt,
          updatedAt: subjects.updatedAt,
          school: {
            id: schools.id,
            name: schools.name,
          },
        })
        .from(subjects)
        .leftJoin(schools, eq(subjects.schoolId, schools.id))
        .orderBy(asc(subjects.name))
    }

    return c.json({
      success: true,
      data: subjectsList,
    })
  } catch (error) {
    console.error('教科一覧取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_SUBJECTS_ERROR',
        message: '教科一覧の取得に失敗しました',
      },
      500
    )
  }
})

// 教科詳細取得
subjectsRouter.get('/:id', async c => {
  try {
    const id = c.req.param('id')
    const db = createDatabase(c.env)

    const subjectData = await db
      .select({
        id: subjects.id,
        name: subjects.name,
        schoolId: subjects.schoolId,
        createdAt: subjects.createdAt,
        updatedAt: subjects.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(subjects)
      .leftJoin(schools, eq(subjects.schoolId, schools.id))
      .where(eq(subjects.id, id))
      .get()

    if (!subjectData) {
      return c.json(
        {
          error: 'SUBJECT_NOT_FOUND',
          message: '指定された教科が見つかりません',
        },
        404
      )
    }

    return c.json({
      success: true,
      data: subjectData,
    })
  } catch (error) {
    console.error('教科詳細取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_SUBJECT_ERROR',
        message: '教科詳細の取得に失敗しました',
      },
      500
    )
  }
})

// 教科作成
subjectsRouter.post('/', zValidator('json', CreateSubjectSchema), async c => {
  try {
    const data: CreateSubjectInput = c.req.valid('json')
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
    const existingSubject = await db
      .select()
      .from(subjects)
      .where(and(eq(subjects.schoolId, data.schoolId), eq(subjects.name, data.name)))
      .get()

    if (existingSubject) {
      return c.json(
        {
          error: 'SUBJECT_ALREADY_EXISTS',
          message: '同じ名前の教科が既に存在します',
        },
        409
      )
    }

    const newSubject = await db.insert(subjects).values(data).returning().get()

    // 作成された教科に学校情報を含めて返す
    const subjectWithSchool = await db
      .select({
        id: subjects.id,
        name: subjects.name,
        schoolId: subjects.schoolId,
        createdAt: subjects.createdAt,
        updatedAt: subjects.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(subjects)
      .leftJoin(schools, eq(subjects.schoolId, schools.id))
      .where(eq(subjects.id, newSubject.id))
      .get()

    return c.json(
      {
        success: true,
        data: subjectWithSchool,
      },
      201
    )
  } catch (error) {
    console.error('教科作成エラー:', error)
    return c.json(
      {
        error: 'CREATE_SUBJECT_ERROR',
        message: '教科の作成に失敗しました',
      },
      500
    )
  }
})

// 教科更新
subjectsRouter.put('/:id', zValidator('json', UpdateSubjectSchema), async c => {
  try {
    const id = c.req.param('id')
    const data: UpdateSubjectInput = c.req.valid('json')
    const db = createDatabase(c.env)

    // 教科の存在確認
    const existingSubject = await db.select().from(subjects).where(eq(subjects.id, id)).get()

    if (!existingSubject) {
      return c.json(
        {
          error: 'SUBJECT_NOT_FOUND',
          message: '指定された教科が見つかりません',
        },
        404
      )
    }

    // 名前の重複チェック（名前が変更される場合）
    if (data.name && data.name !== existingSubject.name) {
      const duplicateSubject = await db
        .select()
        .from(subjects)
        .where(and(eq(subjects.schoolId, existingSubject.schoolId), eq(subjects.name, data.name)))
        .get()

      if (duplicateSubject) {
        return c.json(
          {
            error: 'SUBJECT_ALREADY_EXISTS',
            message: '同じ名前の教科が既に存在します',
          },
          409
        )
      }
    }

    const updatedSubject = await db
      .update(subjects)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(subjects.id, id))
      .returning()
      .get()

    // 更新された教科に学校情報を含めて返す
    const subjectWithSchool = await db
      .select({
        id: subjects.id,
        name: subjects.name,
        schoolId: subjects.schoolId,
        createdAt: subjects.createdAt,
        updatedAt: subjects.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(subjects)
      .leftJoin(schools, eq(subjects.schoolId, schools.id))
      .where(eq(subjects.id, updatedSubject.id))
      .get()

    return c.json({
      success: true,
      data: subjectWithSchool,
    })
  } catch (error) {
    console.error('教科更新エラー:', error)
    return c.json(
      {
        error: 'UPDATE_SUBJECT_ERROR',
        message: '教科の更新に失敗しました',
      },
      500
    )
  }
})

// 教科削除
subjectsRouter.delete('/:id', async c => {
  try {
    const id = c.req.param('id')
    const db = createDatabase(c.env)

    // 教科の存在確認
    const existingSubject = await db.select().from(subjects).where(eq(subjects.id, id)).get()

    if (!existingSubject) {
      return c.json(
        {
          error: 'SUBJECT_NOT_FOUND',
          message: '指定された教科が見つかりません',
        },
        404
      )
    }

    // カスケード削除により、関連する teacherSubjects も自動削除される
    await db.delete(subjects).where(eq(subjects.id, id))

    return c.json({
      success: true,
      message: '教科を削除しました',
    })
  } catch (error) {
    console.error('教科削除エラー:', error)
    return c.json(
      {
        error: 'DELETE_SUBJECT_ERROR',
        message: '教科の削除に失敗しました',
      },
      500
    )
  }
})

export default subjectsRouter
