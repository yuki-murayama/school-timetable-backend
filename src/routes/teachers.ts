/**
 * 教師管理API（Drizzle版）
 * 学校内の教師情報を管理
 */

import { zValidator } from '@hono/zod-validator'
import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { teachers, schools, teacherSubjects, subjects } from '../db/schema'
import { createDatabase, type Env } from '../lib/db'
import {
  type CreateTeacherInput,
  CreateTeacherSchema,
  type UpdateTeacherInput,
  UpdateTeacherSchema,
} from '../lib/validation'

const teachersRouter = new Hono<{ Bindings: Env }>()

// 教師一覧取得（学校IDで絞り込み）
teachersRouter.get('/', async c => {
  try {
    const schoolId = c.req.query('schoolId')
    const db = createDatabase(c.env)

    let teachersList
    if (schoolId) {
      teachersList = await db
        .select({
          id: teachers.id,
          name: teachers.name,
          schoolId: teachers.schoolId,
          createdAt: teachers.createdAt,
          updatedAt: teachers.updatedAt,
          school: {
            id: schools.id,
            name: schools.name,
          },
        })
        .from(teachers)
        .leftJoin(schools, eq(teachers.schoolId, schools.id))
        .where(eq(teachers.schoolId, schoolId))
        .orderBy(asc(teachers.name))
    } else {
      teachersList = await db
        .select({
          id: teachers.id,
          name: teachers.name,
          schoolId: teachers.schoolId,
          createdAt: teachers.createdAt,
          updatedAt: teachers.updatedAt,
          school: {
            id: schools.id,
            name: schools.name,
          },
        })
        .from(teachers)
        .leftJoin(schools, eq(teachers.schoolId, schools.id))
        .orderBy(asc(teachers.name))
    }

    return c.json({
      success: true,
      data: teachersList,
    })
  } catch (error) {
    console.error('教師一覧取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_TEACHERS_ERROR',
        message: '教師一覧の取得に失敗しました',
      },
      500
    )
  }
})

// 教師詳細取得（担当教科も含む）
teachersRouter.get('/:id', async c => {
  try {
    const id = c.req.param('id')
    const db = createDatabase(c.env)

    // 教師の基本情報を取得
    const teacherData = await db
      .select({
        id: teachers.id,
        name: teachers.name,
        schoolId: teachers.schoolId,
        createdAt: teachers.createdAt,
        updatedAt: teachers.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(teachers)
      .leftJoin(schools, eq(teachers.schoolId, schools.id))
      .where(eq(teachers.id, id))
      .get()

    if (!teacherData) {
      return c.json(
        {
          error: 'TEACHER_NOT_FOUND',
          message: '指定された教師が見つかりません',
        },
        404
      )
    }

    // 担当教科を取得
    const teacherSubjectsList = await db
      .select({
        id: teacherSubjects.id,
        subject: {
          id: subjects.id,
          name: subjects.name,
        },
      })
      .from(teacherSubjects)
      .leftJoin(subjects, eq(teacherSubjects.subjectId, subjects.id))
      .where(eq(teacherSubjects.teacherId, id))
      .orderBy(asc(subjects.name))

    const result = {
      ...teacherData,
      subjects: teacherSubjectsList.map(ts => ts.subject),
    }

    return c.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('教師詳細取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_TEACHER_ERROR',
        message: '教師詳細の取得に失敗しました',
      },
      500
    )
  }
})

// 教師作成
teachersRouter.post('/', zValidator('json', CreateTeacherSchema), async c => {
  try {
    const data: CreateTeacherInput = c.req.valid('json')
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

    // 同じ学校内での重複チェック（任意）
    const existingTeacher = await db
      .select()
      .from(teachers)
      .where(and(eq(teachers.schoolId, data.schoolId), eq(teachers.name, data.name)))
      .get()

    if (existingTeacher) {
      return c.json(
        {
          error: 'TEACHER_ALREADY_EXISTS',
          message: '同じ名前の教師が既に存在します',
        },
        409
      )
    }

    const newTeacher = await db.insert(teachers).values(data).returning().get()

    // 作成された教師に学校情報を含めて返す
    const teacherWithSchool = await db
      .select({
        id: teachers.id,
        name: teachers.name,
        schoolId: teachers.schoolId,
        createdAt: teachers.createdAt,
        updatedAt: teachers.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(teachers)
      .leftJoin(schools, eq(teachers.schoolId, schools.id))
      .where(eq(teachers.id, newTeacher.id))
      .get()

    return c.json(
      {
        success: true,
        data: teacherWithSchool,
      },
      201
    )
  } catch (error) {
    console.error('教師作成エラー:', error)
    return c.json(
      {
        error: 'CREATE_TEACHER_ERROR',
        message: '教師の作成に失敗しました',
      },
      500
    )
  }
})

// 教師更新
teachersRouter.put('/:id', zValidator('json', UpdateTeacherSchema), async c => {
  try {
    const id = c.req.param('id')
    const data: UpdateTeacherInput = c.req.valid('json')
    const db = createDatabase(c.env)

    // 教師の存在確認
    const existingTeacher = await db.select().from(teachers).where(eq(teachers.id, id)).get()

    if (!existingTeacher) {
      return c.json(
        {
          error: 'TEACHER_NOT_FOUND',
          message: '指定された教師が見つかりません',
        },
        404
      )
    }

    // 名前の重複チェック（名前が変更される場合）
    if (data.name && data.name !== existingTeacher.name) {
      const duplicateTeacher = await db
        .select()
        .from(teachers)
        .where(
          and(
            eq(teachers.schoolId, existingTeacher.schoolId),
            eq(teachers.name, data.name)
          )
        )
        .get()

      if (duplicateTeacher) {
        return c.json(
          {
            error: 'TEACHER_ALREADY_EXISTS',
            message: '同じ名前の教師が既に存在します',
          },
          409
        )
      }
    }

    const updatedTeacher = await db
      .update(teachers)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(teachers.id, id))
      .returning()
      .get()

    // 更新された教師に学校情報を含めて返す
    const teacherWithSchool = await db
      .select({
        id: teachers.id,
        name: teachers.name,
        schoolId: teachers.schoolId,
        createdAt: teachers.createdAt,
        updatedAt: teachers.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(teachers)
      .leftJoin(schools, eq(teachers.schoolId, schools.id))
      .where(eq(teachers.id, updatedTeacher.id))
      .get()

    return c.json({
      success: true,
      data: teacherWithSchool,
    })
  } catch (error) {
    console.error('教師更新エラー:', error)
    return c.json(
      {
        error: 'UPDATE_TEACHER_ERROR',
        message: '教師の更新に失敗しました',
      },
      500
    )
  }
})

// 教師削除
teachersRouter.delete('/:id', async c => {
  try {
    const id = c.req.param('id')
    const db = createDatabase(c.env)

    // 教師の存在確認
    const existingTeacher = await db.select().from(teachers).where(eq(teachers.id, id)).get()

    if (!existingTeacher) {
      return c.json(
        {
          error: 'TEACHER_NOT_FOUND',
          message: '指定された教師が見つかりません',
        },
        404
      )
    }

    // カスケード削除により、関連する teacherSubjects も自動削除される
    await db.delete(teachers).where(eq(teachers.id, id))

    return c.json({
      success: true,
      message: '教師を削除しました',
    })
  } catch (error) {
    console.error('教師削除エラー:', error)
    return c.json(
      {
        error: 'DELETE_TEACHER_ERROR',
        message: '教師の削除に失敗しました',
      },
      500
    )
  }
})

export default teachersRouter