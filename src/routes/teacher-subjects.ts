/**
 * 教師-教科関係管理API（Drizzle版）
 * 教師の担当教科の割り当てを管理
 */

import { zValidator } from '@hono/zod-validator'
import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { subjects, teacherSubjects, teachers } from '../db/schema'
import { createDatabase, type Env } from '../lib/db'

const teacherSubjectsRouter = new Hono<{ Bindings: Env }>()

// 教師の担当教科一覧取得
teacherSubjectsRouter.get('/teachers/:teacherId/subjects', async c => {
  try {
    const teacherId = c.req.param('teacherId')
    const db = createDatabase(c.env)

    // 教師の存在確認
    const teacher = await db.select().from(teachers).where(eq(teachers.id, teacherId)).get()

    if (!teacher) {
      return c.json(
        {
          error: 'TEACHER_NOT_FOUND',
          message: '指定された教師が見つかりません',
        },
        404
      )
    }

    // 教師の担当教科を取得
    const teacherSubjectsList = await db
      .select({
        id: teacherSubjects.id,
        teacherId: teacherSubjects.teacherId,
        subjectId: teacherSubjects.subjectId,
        createdAt: teacherSubjects.createdAt,
        subject: {
          id: subjects.id,
          name: subjects.name,
          schoolId: subjects.schoolId,
        },
      })
      .from(teacherSubjects)
      .leftJoin(subjects, eq(teacherSubjects.subjectId, subjects.id))
      .where(eq(teacherSubjects.teacherId, teacherId))
      .orderBy(asc(subjects.name))

    return c.json({
      success: true,
      data: {
        teacher: {
          id: teacher.id,
          name: teacher.name,
          schoolId: teacher.schoolId,
        },
        subjects: teacherSubjectsList.map(ts => ts.subject),
        assignments: teacherSubjectsList,
      },
    })
  } catch (error) {
    console.error('教師担当教科取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_TEACHER_SUBJECTS_ERROR',
        message: '教師の担当教科の取得に失敗しました',
      },
      500
    )
  }
})

// 教科を担当する教師一覧取得
teacherSubjectsRouter.get('/subjects/:subjectId/teachers', async c => {
  try {
    const subjectId = c.req.param('subjectId')
    const db = createDatabase(c.env)

    // 教科の存在確認
    const subject = await db.select().from(subjects).where(eq(subjects.id, subjectId)).get()

    if (!subject) {
      return c.json(
        {
          error: 'SUBJECT_NOT_FOUND',
          message: '指定された教科が見つかりません',
        },
        404
      )
    }

    // 教科を担当する教師を取得
    const subjectTeachersList = await db
      .select({
        id: teacherSubjects.id,
        teacherId: teacherSubjects.teacherId,
        subjectId: teacherSubjects.subjectId,
        createdAt: teacherSubjects.createdAt,
        teacher: {
          id: teachers.id,
          name: teachers.name,
          schoolId: teachers.schoolId,
        },
      })
      .from(teacherSubjects)
      .leftJoin(teachers, eq(teacherSubjects.teacherId, teachers.id))
      .where(eq(teacherSubjects.subjectId, subjectId))
      .orderBy(asc(teachers.name))

    return c.json({
      success: true,
      data: {
        subject: {
          id: subject.id,
          name: subject.name,
          schoolId: subject.schoolId,
        },
        teachers: subjectTeachersList.map(st => st.teacher),
        assignments: subjectTeachersList,
      },
    })
  } catch (error) {
    console.error('教科担当教師取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_SUBJECT_TEACHERS_ERROR',
        message: '教科の担当教師の取得に失敗しました',
      },
      500
    )
  }
})

// 教師に教科を割り当て
const AssignSubjectSchema = z.object({
  subjectId: z.string().min(1, '教科IDは必須です'),
})

teacherSubjectsRouter.post(
  '/teachers/:teacherId/subjects',
  zValidator('json', AssignSubjectSchema),
  async c => {
    try {
      const teacherId = c.req.param('teacherId')
      const { subjectId } = c.req.valid('json')
      const db = createDatabase(c.env)

      // 教師の存在確認
      const teacher = await db.select().from(teachers).where(eq(teachers.id, teacherId)).get()

      if (!teacher) {
        return c.json(
          {
            error: 'TEACHER_NOT_FOUND',
            message: '指定された教師が見つかりません',
          },
          404
        )
      }

      // 教科の存在確認
      const subject = await db.select().from(subjects).where(eq(subjects.id, subjectId)).get()

      if (!subject) {
        return c.json(
          {
            error: 'SUBJECT_NOT_FOUND',
            message: '指定された教科が見つかりません',
          },
          404
        )
      }

      // 同じ学校かチェック
      if (teacher.schoolId !== subject.schoolId) {
        return c.json(
          {
            error: 'SCHOOL_MISMATCH',
            message: '教師と教科が異なる学校に属しています',
          },
          400
        )
      }

      // 既に割り当て済みかチェック
      const existingAssignment = await db
        .select()
        .from(teacherSubjects)
        .where(
          and(eq(teacherSubjects.teacherId, teacherId), eq(teacherSubjects.subjectId, subjectId))
        )
        .get()

      if (existingAssignment) {
        return c.json(
          {
            error: 'ASSIGNMENT_ALREADY_EXISTS',
            message: 'この教師は既にこの教科を担当しています',
          },
          409
        )
      }

      // 割り当て作成
      const newAssignment = await db
        .insert(teacherSubjects)
        .values({ teacherId, subjectId })
        .returning()
        .get()

      // 作成された割り当てに詳細情報を含めて返す
      const assignmentWithDetails = await db
        .select({
          id: teacherSubjects.id,
          teacherId: teacherSubjects.teacherId,
          subjectId: teacherSubjects.subjectId,
          createdAt: teacherSubjects.createdAt,
          teacher: {
            id: teachers.id,
            name: teachers.name,
            schoolId: teachers.schoolId,
          },
          subject: {
            id: subjects.id,
            name: subjects.name,
            schoolId: subjects.schoolId,
          },
        })
        .from(teacherSubjects)
        .leftJoin(teachers, eq(teacherSubjects.teacherId, teachers.id))
        .leftJoin(subjects, eq(teacherSubjects.subjectId, subjects.id))
        .where(eq(teacherSubjects.id, newAssignment.id))
        .get()

      return c.json(
        {
          success: true,
          data: assignmentWithDetails,
          message: '教科の割り当てが完了しました',
        },
        201
      )
    } catch (error) {
      console.error('教科割り当てエラー:', error)
      return c.json(
        {
          error: 'ASSIGN_SUBJECT_ERROR',
          message: '教科の割り当てに失敗しました',
        },
        500
      )
    }
  }
)

// 教師から教科の割り当てを削除
teacherSubjectsRouter.delete('/teachers/:teacherId/subjects/:subjectId', async c => {
  try {
    const teacherId = c.req.param('teacherId')
    const subjectId = c.req.param('subjectId')
    const db = createDatabase(c.env)

    // 割り当ての存在確認
    const existingAssignment = await db
      .select()
      .from(teacherSubjects)
      .where(
        and(eq(teacherSubjects.teacherId, teacherId), eq(teacherSubjects.subjectId, subjectId))
      )
      .get()

    if (!existingAssignment) {
      return c.json(
        {
          error: 'ASSIGNMENT_NOT_FOUND',
          message: '指定された割り当てが見つかりません',
        },
        404
      )
    }

    // 割り当て削除
    await db
      .delete(teacherSubjects)
      .where(
        and(eq(teacherSubjects.teacherId, teacherId), eq(teacherSubjects.subjectId, subjectId))
      )

    return c.json({
      success: true,
      message: '教科の割り当てを削除しました',
    })
  } catch (error) {
    console.error('教科割り当て削除エラー:', error)
    return c.json(
      {
        error: 'DELETE_ASSIGNMENT_ERROR',
        message: '教科の割り当て削除に失敗しました',
      },
      500
    )
  }
})

// 学校内の全教師-教科関係を取得
teacherSubjectsRouter.get('/schools/:schoolId/assignments', async c => {
  try {
    const schoolId = c.req.param('schoolId')
    const db = createDatabase(c.env)

    // 学校内の全教師-教科関係を取得
    const assignments = await db
      .select({
        id: teacherSubjects.id,
        teacherId: teacherSubjects.teacherId,
        subjectId: teacherSubjects.subjectId,
        createdAt: teacherSubjects.createdAt,
        teacher: {
          id: teachers.id,
          name: teachers.name,
          schoolId: teachers.schoolId,
        },
        subject: {
          id: subjects.id,
          name: subjects.name,
          schoolId: subjects.schoolId,
        },
      })
      .from(teacherSubjects)
      .leftJoin(teachers, eq(teacherSubjects.teacherId, teachers.id))
      .leftJoin(subjects, eq(teacherSubjects.subjectId, subjects.id))
      .where(eq(teachers.schoolId, schoolId))
      .orderBy(asc(teachers.name), asc(subjects.name))

    return c.json({
      success: true,
      data: assignments,
    })
  } catch (error) {
    console.error('学校内割り当て取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_SCHOOL_ASSIGNMENTS_ERROR',
        message: '学校内の割り当ての取得に失敗しました',
      },
      500
    )
  }
})

// 複数教科の一括割り当て
const BulkAssignSchema = z.object({
  subjectIds: z.array(z.string()).min(1, '教科IDは少なくとも1つ必要です'),
})

teacherSubjectsRouter.post(
  '/teachers/:teacherId/subjects/bulk',
  zValidator('json', BulkAssignSchema),
  async c => {
    try {
      const teacherId = c.req.param('teacherId')
      const { subjectIds } = c.req.valid('json')
      const db = createDatabase(c.env)

      // 教師の存在確認
      const teacher = await db.select().from(teachers).where(eq(teachers.id, teacherId)).get()

      if (!teacher) {
        return c.json(
          {
            error: 'TEACHER_NOT_FOUND',
            message: '指定された教師が見つかりません',
          },
          404
        )
      }

      const results = []
      const errors = []

      for (const subjectId of subjectIds) {
        try {
          // 教科の存在確認
          const subject = await db.select().from(subjects).where(eq(subjects.id, subjectId)).get()

          if (!subject) {
            errors.push({ subjectId, error: '教科が見つかりません' })
            continue
          }

          // 同じ学校かチェック
          if (teacher.schoolId !== subject.schoolId) {
            errors.push({ subjectId, error: '教師と教科が異なる学校に属しています' })
            continue
          }

          // 既に割り当て済みかチェック
          const existingAssignment = await db
            .select()
            .from(teacherSubjects)
            .where(
              and(
                eq(teacherSubjects.teacherId, teacherId),
                eq(teacherSubjects.subjectId, subjectId)
              )
            )
            .get()

          if (existingAssignment) {
            errors.push({ subjectId, error: '既に割り当て済みです' })
            continue
          }

          // 割り当て作成
          const newAssignment = await db
            .insert(teacherSubjects)
            .values({ teacherId, subjectId })
            .returning()
            .get()

          results.push({
            assignmentId: newAssignment.id,
            subjectId,
            subjectName: subject.name,
          })
        } catch (error) {
          errors.push({ subjectId, error: '割り当て処理でエラーが発生しました' })
        }
      }

      return c.json(
        {
          success: true,
          data: {
            assigned: results,
            errors,
            totalRequested: subjectIds.length,
            successfulAssignments: results.length,
            failedAssignments: errors.length,
          },
          message: `${results.length}件の教科を割り当てました`,
        },
        201
      )
    } catch (error) {
      console.error('一括教科割り当てエラー:', error)
      return c.json(
        {
          error: 'BULK_ASSIGN_SUBJECTS_ERROR',
          message: '教科の一括割り当てに失敗しました',
        },
        500
      )
    }
  }
)

export default teacherSubjectsRouter
