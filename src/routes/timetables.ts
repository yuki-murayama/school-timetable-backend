/**
 * 時間割管理API（Drizzle版）
 * 学校の時間割を管理
 */

import { zValidator } from '@hono/zod-validator'
import { and, asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  classes,
  classrooms,
  schedules,
  schools,
  subjects,
  teachers,
  timetables,
} from '../db/schema'
import { createDatabase, type Env } from '../lib/db'
import {
  type BulkGenerateTimetableInput,
  BulkGenerateTimetableSchema,
  type CreateTimetableInput,
  CreateTimetableSchema,
  type GenerateTimetableInput,
  GenerateTimetableSchema,
  type UpdateTimetableInput,
  UpdateTimetableSchema,
} from '../lib/validation'

const timetablesRouter = new Hono<{ Bindings: Env }>()

// 時間割一覧取得（学校IDで絞り込み）
timetablesRouter.get('/', async c => {
  try {
    const schoolId = c.req.query('schoolId')
    const isActive = c.req.query('isActive')
    const db = createDatabase(c.env)

    let query = db
      .select({
        id: timetables.id,
        name: timetables.name,
        schoolId: timetables.schoolId,
        isActive: timetables.isActive,
        saturdayHours: timetables.saturdayHours,
        createdAt: timetables.createdAt,
        updatedAt: timetables.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(timetables)
      .leftJoin(schools, eq(timetables.schoolId, schools.id))

    const conditions = []
    if (schoolId) {
      conditions.push(eq(timetables.schoolId, schoolId))
    }
    if (isActive !== undefined) {
      conditions.push(eq(timetables.isActive, isActive === 'true'))
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions))
    }

    const timetablesList = await query.orderBy(
      desc(timetables.isActive),
      desc(timetables.createdAt)
    )

    return c.json({
      success: true,
      data: timetablesList,
    })
  } catch (error) {
    console.error('時間割一覧取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_TIMETABLES_ERROR',
        message: '時間割一覧の取得に失敗しました',
      },
      500
    )
  }
})

// 時間割詳細取得（時間割スロットも含む）
timetablesRouter.get('/:id', async c => {
  try {
    const id = c.req.param('id')
    const includeSlots = c.req.query('includeSlots') === 'true'
    const db = createDatabase(c.env)

    // 時間割の基本情報を取得
    const timetableData = await db
      .select({
        id: timetables.id,
        name: timetables.name,
        schoolId: timetables.schoolId,
        isActive: timetables.isActive,
        saturdayHours: timetables.saturdayHours,
        createdAt: timetables.createdAt,
        updatedAt: timetables.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(timetables)
      .leftJoin(schools, eq(timetables.schoolId, schools.id))
      .where(eq(timetables.id, id))
      .get()

    if (!timetableData) {
      return c.json(
        {
          error: 'TIMETABLE_NOT_FOUND',
          message: '指定された時間割が見つかりません',
        },
        404
      )
    }

    let result: any = timetableData

    // スロット情報も含める場合
    if (includeSlots) {
      const slots = await db
        .select({
          id: schedules.id,
          timetableId: schedules.timetableId,
          classId: schedules.classId,
          subjectId: schedules.subjectId,
          teacherId: schedules.teacherId,
          classroomId: schedules.classroomId,
          dayOfWeek: schedules.dayOfWeek,
          period: schedules.period,
          class: {
            id: classes.id,
            name: classes.name,
            grade: classes.grade,
          },
          subject: {
            id: subjects.id,
            name: subjects.name,
          },
          teacher: {
            id: teachers.id,
            name: teachers.name,
          },
          classroom: {
            id: classrooms.id,
            name: classrooms.name,
            type: classrooms.type,
          },
        })
        .from(schedules)
        .leftJoin(classes, eq(schedules.classId, classes.id))
        .leftJoin(subjects, eq(schedules.subjectId, subjects.id))
        .leftJoin(teachers, eq(schedules.teacherId, teachers.id))
        .leftJoin(classrooms, eq(schedules.classroomId, classrooms.id))
        .where(eq(schedules.timetableId, id))
        .orderBy(asc(schedules.dayOfWeek), asc(schedules.period))

      result = {
        ...timetableData,
        slots,
      }
    }

    return c.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('時間割詳細取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_TIMETABLE_ERROR',
        message: '時間割詳細の取得に失敗しました',
      },
      500
    )
  }
})

// 時間割作成
timetablesRouter.post('/', zValidator('json', CreateTimetableSchema), async c => {
  try {
    const data: CreateTimetableInput = c.req.valid('json')
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
    const existingTimetable = await db
      .select()
      .from(timetables)
      .where(and(eq(timetables.schoolId, data.schoolId), eq(timetables.name, data.name)))
      .get()

    if (existingTimetable) {
      return c.json(
        {
          error: 'TIMETABLE_ALREADY_EXISTS',
          message: '同じ名前の時間割が既に存在します',
        },
        409
      )
    }

    // 新しい時間割をアクティブにする場合、既存のアクティブ時間割を非アクティブに
    if (data.isActive === undefined || data.isActive === true) {
      await db
        .update(timetables)
        .set({ isActive: false, updatedAt: new Date().toISOString() })
        .where(and(eq(timetables.schoolId, data.schoolId), eq(timetables.isActive, true)))
    }

    const newTimetable = await db
      .insert(timetables)
      .values({
        ...data,
        isActive: data.isActive === undefined ? true : data.isActive,
      })
      .returning()
      .get()

    // 作成された時間割に学校情報を含めて返す
    const timetableWithSchool = await db
      .select({
        id: timetables.id,
        name: timetables.name,
        schoolId: timetables.schoolId,
        isActive: timetables.isActive,
        saturdayHours: timetables.saturdayHours,
        createdAt: timetables.createdAt,
        updatedAt: timetables.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(timetables)
      .leftJoin(schools, eq(timetables.schoolId, schools.id))
      .where(eq(timetables.id, newTimetable.id))
      .get()

    return c.json(
      {
        success: true,
        data: timetableWithSchool,
      },
      201
    )
  } catch (error) {
    console.error('時間割作成エラー:', error)
    return c.json(
      {
        error: 'CREATE_TIMETABLE_ERROR',
        message: '時間割の作成に失敗しました',
      },
      500
    )
  }
})

// 時間割更新
timetablesRouter.put('/:id', zValidator('json', UpdateTimetableSchema), async c => {
  try {
    const id = c.req.param('id')
    const data: UpdateTimetableInput = c.req.valid('json')
    const db = createDatabase(c.env)

    // 時間割の存在確認
    const existingTimetable = await db.select().from(timetables).where(eq(timetables.id, id)).get()

    if (!existingTimetable) {
      return c.json(
        {
          error: 'TIMETABLE_NOT_FOUND',
          message: '指定された時間割が見つかりません',
        },
        404
      )
    }

    // 名前の重複チェック（名前が変更される場合）
    if (data.name && data.name !== existingTimetable.name) {
      const duplicateTimetable = await db
        .select()
        .from(timetables)
        .where(
          and(eq(timetables.schoolId, existingTimetable.schoolId), eq(timetables.name, data.name))
        )
        .get()

      if (duplicateTimetable) {
        return c.json(
          {
            error: 'TIMETABLE_ALREADY_EXISTS',
            message: '同じ名前の時間割が既に存在します',
          },
          409
        )
      }
    }

    // アクティブ状態を変更する場合
    if (data.isActive === true) {
      await db
        .update(timetables)
        .set({ isActive: false, updatedAt: new Date().toISOString() })
        .where(
          and(eq(timetables.schoolId, existingTimetable.schoolId), eq(timetables.isActive, true))
        )
    }

    const updatedTimetable = await db
      .update(timetables)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(timetables.id, id))
      .returning()
      .get()

    // 更新された時間割に学校情報を含めて返す
    const timetableWithSchool = await db
      .select({
        id: timetables.id,
        name: timetables.name,
        schoolId: timetables.schoolId,
        isActive: timetables.isActive,
        saturdayHours: timetables.saturdayHours,
        createdAt: timetables.createdAt,
        updatedAt: timetables.updatedAt,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(timetables)
      .leftJoin(schools, eq(timetables.schoolId, schools.id))
      .where(eq(timetables.id, updatedTimetable.id))
      .get()

    return c.json({
      success: true,
      data: timetableWithSchool,
    })
  } catch (error) {
    console.error('時間割更新エラー:', error)
    return c.json(
      {
        error: 'UPDATE_TIMETABLE_ERROR',
        message: '時間割の更新に失敗しました',
      },
      500
    )
  }
})

// 時間割削除
timetablesRouter.delete('/:id', async c => {
  try {
    const id = c.req.param('id')
    const db = createDatabase(c.env)

    // 時間割の存在確認
    const existingTimetable = await db.select().from(timetables).where(eq(timetables.id, id)).get()

    if (!existingTimetable) {
      return c.json(
        {
          error: 'TIMETABLE_NOT_FOUND',
          message: '指定された時間割が見つかりません',
        },
        404
      )
    }

    // カスケード削除により、関連する timetableSlots も自動削除される
    await db.delete(timetables).where(eq(timetables.id, id))

    return c.json({
      success: true,
      message: '時間割を削除しました',
    })
  } catch (error) {
    console.error('時間割削除エラー:', error)
    return c.json(
      {
        error: 'DELETE_TIMETABLE_ERROR',
        message: '時間割の削除に失敗しました',
      },
      500
    )
  }
})

// 時間割スロット管理

// 時間割スロット一括設定
const SetSlotsSchema = z.object({
  slots: z.array(
    z.object({
      classId: z.string().min(1, 'クラスIDは必須です'),
      subjectId: z.string().min(1, '教科IDは必須です'),
      teacherId: z.string().min(1, '教師IDは必須です'),
      classroomId: z.string().optional(),
      dayOfWeek: z.number().int().min(1).max(6), // 1=月, 2=火, ..., 6=土
      period: z.number().int().min(1).max(8),
    })
  ),
})

timetablesRouter.post('/:id/slots', zValidator('json', SetSlotsSchema), async c => {
  try {
    const timetableId = c.req.param('id')
    const { slots } = c.req.valid('json')
    const db = createDatabase(c.env)

    // 時間割の存在確認
    const timetable = await db.select().from(timetables).where(eq(timetables.id, timetableId)).get()

    if (!timetable) {
      return c.json(
        {
          error: 'TIMETABLE_NOT_FOUND',
          message: '指定された時間割が見つかりません',
        },
        404
      )
    }

    // 既存のスロットを削除
    await db.delete(schedules).where(eq(schedules.timetableId, timetableId))

    const results = []
    const errors = []

    // 新しいスロットを挿入
    for (const slot of slots) {
      try {
        // 関連データの存在確認
        const [classData, subject, teacher] = await Promise.all([
          db.select().from(classes).where(eq(classes.id, slot.classId)).get(),
          db.select().from(subjects).where(eq(subjects.id, slot.subjectId)).get(),
          db.select().from(teachers).where(eq(teachers.id, slot.teacherId)).get(),
        ])

        if (!classData) {
          errors.push({ slot, error: 'クラスが見つかりません' })
          continue
        }
        if (!subject) {
          errors.push({ slot, error: '教科が見つかりません' })
          continue
        }
        if (!teacher) {
          errors.push({ slot, error: '教師が見つかりません' })
          continue
        }

        // 教室の確認（オプション）
        if (slot.classroomId) {
          const classroom = await db
            .select()
            .from(classrooms)
            .where(eq(classrooms.id, slot.classroomId))
            .get()
          if (!classroom) {
            errors.push({ slot, error: '教室が見つかりません' })
            continue
          }
        }

        const newSlot = await db
          .insert(schedules)
          .values({
            timetableId,
            ...slot,
          })
          .returning()
          .get()

        results.push(newSlot)
      } catch (error) {
        errors.push({ slot, error: 'スロット作成でエラーが発生しました' })
      }
    }

    return c.json({
      success: true,
      data: {
        created: results,
        errors,
        totalRequested: slots.length,
        successfulCreations: results.length,
        failedCreations: errors.length,
      },
      message: `${results.length}個のスロットを作成しました`,
    })
  } catch (error) {
    console.error('時間割スロット設定エラー:', error)
    return c.json(
      {
        error: 'SET_SLOTS_ERROR',
        message: '時間割スロットの設定に失敗しました',
      },
      500
    )
  }
})

// 時間割スロット取得（特定のクラス用）
timetablesRouter.get('/:id/slots/:classId', async c => {
  try {
    const timetableId = c.req.param('id')
    const classId = c.req.param('classId')
    const db = createDatabase(c.env)

    const slots = await db
      .select({
        id: schedules.id,
        timetableId: schedules.timetableId,
        classId: schedules.classId,
        subjectId: schedules.subjectId,
        teacherId: schedules.teacherId,
        classroomId: schedules.classroomId,
        dayOfWeek: schedules.dayOfWeek,
        period: schedules.period,
        subject: {
          id: subjects.id,
          name: subjects.name,
        },
        teacher: {
          id: teachers.id,
          name: teachers.name,
        },
        classroom: {
          id: classrooms.id,
          name: classrooms.name,
          type: classrooms.type,
        },
      })
      .from(schedules)
      .leftJoin(subjects, eq(schedules.subjectId, subjects.id))
      .leftJoin(teachers, eq(schedules.teacherId, teachers.id))
      .leftJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .where(and(eq(schedules.timetableId, timetableId), eq(schedules.classId, classId)))
      .orderBy(asc(schedules.dayOfWeek), asc(schedules.period))

    return c.json({
      success: true,
      data: slots,
    })
  } catch (error) {
    console.error('クラス時間割取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_CLASS_TIMETABLE_ERROR',
        message: 'クラス時間割の取得に失敗しました',
      },
      500
    )
  }
})

// 教師の時間割取得
timetablesRouter.get('/:id/teachers/:teacherId', async c => {
  try {
    const timetableId = c.req.param('id')
    const teacherId = c.req.param('teacherId')
    const db = createDatabase(c.env)

    const slots = await db
      .select({
        id: schedules.id,
        timetableId: schedules.timetableId,
        classId: schedules.classId,
        subjectId: schedules.subjectId,
        teacherId: schedules.teacherId,
        classroomId: schedules.classroomId,
        dayOfWeek: schedules.dayOfWeek,
        period: schedules.period,
        class: {
          id: classes.id,
          name: classes.name,
          grade: classes.grade,
        },
        subject: {
          id: subjects.id,
          name: subjects.name,
        },
        classroom: {
          id: classrooms.id,
          name: classrooms.name,
          type: classrooms.type,
        },
      })
      .from(schedules)
      .leftJoin(classes, eq(schedules.classId, classes.id))
      .leftJoin(subjects, eq(schedules.subjectId, subjects.id))
      .leftJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .where(and(eq(schedules.timetableId, timetableId), eq(schedules.teacherId, teacherId)))
      .orderBy(asc(schedules.dayOfWeek), asc(schedules.period))

    return c.json({
      success: true,
      data: slots,
    })
  } catch (error) {
    console.error('教師時間割取得エラー:', error)
    return c.json(
      {
        error: 'FETCH_TEACHER_TIMETABLE_ERROR',
        message: '教師時間割の取得に失敗しました',
      },
      500
    )
  }
})

// 時間割生成エンドポイント
timetablesRouter.post('/:id/generate', zValidator('json', GenerateTimetableSchema), async c => {
  try {
    const timetableId = c.req.param('id')
    const { requirements, priority } = c.req.valid('json')
    const db = createDatabase(c.env)

    // Gemini API キーの確認
    const geminiApiKey = c.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return c.json(
        {
          error: 'GEMINI_API_KEY_NOT_CONFIGURED',
          message: 'Gemini API キーが設定されていません',
        },
        500
      )
    }

    // 時間割の存在確認
    const timetable = await db.select().from(timetables).where(eq(timetables.id, timetableId)).get()

    if (!timetable) {
      return c.json(
        {
          error: 'TIMETABLE_NOT_FOUND',
          message: '指定された時間割が見つかりません',
        },
        404
      )
    }

    // 時間割生成処理を動的インポート
    const { generateTimetable } = await import('../lib/timetable-generator')

    // 時間割生成の実行（単発）
    const result = await generateTimetable(db, timetableId, requirements, priority, geminiApiKey)

    if (result.success) {
      return c.json({
        success: true,
        data: {
          timetableId: result.data?.timetableId,
          slotsCreated: result.data?.slotsCreated,
          message: '時間割生成が完了しました',
        },
      })
    } else {
      const statusCode =
        result.error === 'TIMETABLE_NOT_FOUND'
          ? 404
          : result.error === 'INVALID_API_KEY'
            ? 401
            : 500

      return c.json(
        {
          error: result.error,
          message: result.message,
          retryable: result.retryable,
        },
        statusCode
      )
    }
  } catch (error) {
    console.error('時間割生成エラー:', error)
    return c.json(
      {
        error: 'GENERATE_TIMETABLE_ERROR',
        message: '時間割生成に失敗しました',
      },
      500
    )
  }
})

// 時間割生成状況確認エンドポイント
timetablesRouter.get('/:id/generation-status', async c => {
  try {
    const timetableId = c.req.param('id')
    const db = createDatabase(c.env)

    // 時間割生成処理を動的インポート
    const { getTimetableGenerationStatus } = await import('../lib/timetable-generator')

    const status = await getTimetableGenerationStatus(db, timetableId)

    if (!status.timetableExists) {
      return c.json(
        {
          error: 'TIMETABLE_NOT_FOUND',
          message: '指定された時間割が見つかりません',
        },
        404
      )
    }

    return c.json({
      success: true,
      data: {
        timetableId,
        hasSchedules: status.hasSchedules,
        scheduleCount: status.scheduleCount,
        status: status.hasSchedules ? 'completed' : 'empty',
      },
    })
  } catch (error) {
    console.error('時間割生成状況確認エラー:', error)
    return c.json(
      {
        error: 'GET_GENERATION_STATUS_ERROR',
        message: '時間割生成状況の確認に失敗しました',
      },
      500
    )
  }
})

// バルク時間割生成エンドポイント
timetablesRouter.post(
  '/:id/bulk-generate',
  zValidator('json', BulkGenerateTimetableSchema),
  async c => {
    try {
      const timetableId = c.req.param('id')
      const bulkRequest = c.req.valid('json')
      const db = createDatabase(c.env)

      // Gemini API キーの確認
      const geminiApiKey = c.env.GEMINI_API_KEY
      if (!geminiApiKey) {
        return c.json(
          {
            error: 'GEMINI_API_KEY_NOT_CONFIGURED',
            message: 'Gemini API キーが設定されていません',
          },
          500
        )
      }

      // 時間割の存在確認
      const timetable = await db
        .select()
        .from(timetables)
        .where(eq(timetables.id, timetableId))
        .get()

      if (!timetable) {
        return c.json(
          {
            error: 'TIMETABLE_NOT_FOUND',
            message: '指定された時間割が見つかりません',
          },
          404
        )
      }

      // バルク時間割生成処理を動的インポート
      const { generateBulkTimetable } = await import('../lib/bulk-timetable-generator')

      // バルク時間割生成の実行
      const result = await generateBulkTimetable(db, timetableId, bulkRequest, geminiApiKey)

      if (result.success) {
        return c.json({
          success: true,
          data: {
            timetableId: result.data?.timetableId,
            classIds: result.data?.classIds,
            totalSlotsCreated: result.data?.totalSlotsCreated,
            slotsPerClass: result.data?.slotsPerClass,
            message: `${result.data?.classIds.length}クラスの時間割生成が完了しました`,
          },
        })
      } else {
        const statusCode =
          result.error === 'TIMETABLE_NOT_FOUND'
            ? 404
            : result.error === 'CLASS_NOT_FOUND'
              ? 404
              : result.error === 'INVALID_API_KEY'
                ? 401
                : 500

        return c.json(
          {
            error: result.error,
            message: result.message,
            retryable: result.retryable,
          },
          statusCode
        )
      }
    } catch (error) {
      console.error('バルク時間割生成エラー:', error)
      return c.json(
        {
          error: 'BULK_GENERATE_TIMETABLE_ERROR',
          message: 'バルク時間割生成に失敗しました',
          retryable: true,
        },
        500
      )
    }
  }
)

export default timetablesRouter
