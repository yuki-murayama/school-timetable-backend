import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Env = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Env }>()

// デフォルト設定
const defaultSettings = {
  grade1Classes: 4,
  grade2Classes: 4,
  grade3Classes: 3,
  dailyPeriods: 6,
  saturdayPeriods: 4,
}

// CORS設定
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:3000',
      'https://school-timetable-frontend.vercel.app',
      'https://master.school-timetable-frontend.pages.dev',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    credentials: true,
    maxAge: 86400,
  })
)

// シンプルなテストエンドポイント
app.get('/health', c => {
  return c.json({ status: 'ok', message: 'Simple backend is running' })
})

// ルートエンドポイント
app.get('/', c => {
  return c.json({ message: 'School Timetable Backend API', status: 'running' })
})

// 学校設定取得（D1データベース対応）
app.get('/api/frontend/school/settings', async c => {
  try {
    const db = c.env.DB

    // D1データベースから設定を取得
    const result = await db
      .prepare(`
      SELECT * FROM school_settings WHERE id = 'default' LIMIT 1
    `)
      .first()

    if (result) {
      // データベースから取得した設定を返す
      const settings = {
        grade1Classes: result.grade1Classes || defaultSettings.grade1Classes,
        grade2Classes: result.grade2Classes || defaultSettings.grade2Classes,
        grade3Classes: result.grade3Classes || defaultSettings.grade3Classes,
        dailyPeriods: result.dailyPeriods || defaultSettings.dailyPeriods,
        saturdayPeriods: result.saturdayPeriods || defaultSettings.saturdayPeriods,
      }

      return c.json({
        success: true,
        data: settings,
      })
    } else {
      // データが存在しない場合はデフォルト設定を返す
      return c.json({
        success: true,
        data: defaultSettings,
      })
    }
  } catch (error) {
    // エラーの場合はデフォルト設定を返す
    return c.json({
      success: true,
      data: defaultSettings,
    })
  }
})

// 学校設定更新（D1データベース対応）
app.put('/api/frontend/school/settings', async c => {
  try {
    const body = await c.req.json()
    const db = c.env.DB

    // 新しい設定値を準備
    const newSettings = {
      grade1Classes: body.grade1Classes || defaultSettings.grade1Classes,
      grade2Classes: body.grade2Classes || defaultSettings.grade2Classes,
      grade3Classes: body.grade3Classes || defaultSettings.grade3Classes,
      dailyPeriods: body.dailyPeriods || defaultSettings.dailyPeriods,
      saturdayPeriods: body.saturdayPeriods || defaultSettings.saturdayPeriods,
    }

    // D1データベースのテーブルが存在しない場合は作成
    await db
      .prepare(`
      CREATE TABLE IF NOT EXISTS school_settings (
        id TEXT PRIMARY KEY,
        grade1Classes INTEGER,
        grade2Classes INTEGER,
        grade3Classes INTEGER,
        dailyPeriods INTEGER,
        saturdayPeriods INTEGER,
        updated_at TEXT
      )
    `)
      .run()

    // データを保存（UPSERT）
    await db
      .prepare(`
      INSERT OR REPLACE INTO school_settings 
      (id, grade1Classes, grade2Classes, grade3Classes, dailyPeriods, saturdayPeriods, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        'default',
        newSettings.grade1Classes,
        newSettings.grade2Classes,
        newSettings.grade3Classes,
        newSettings.dailyPeriods,
        newSettings.saturdayPeriods,
        new Date().toISOString()
      )
      .run()

    return c.json({
      success: true,
      data: {
        message: '設定が正常に更新されました',
        settings: newSettings,
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 認証ユーザー情報取得（フロントエンドが要求）
app.get('/auth/user/me', c => {
  return c.json({
    success: true,
    data: {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: null,
      },
      auth: {
        role: 'school_admin',
        schoolId: 'school-1',
        permissions: ['schools:read', 'schools:write', 'classes:read', 'classes:write'],
      },
      metadata: {
        role: 'school_admin',
        schoolId: 'school-1',
      },
    },
  })
})

// ユーザー権限一覧取得（フロントエンドが要求）
app.get('/auth/user/permissions', c => {
  return c.json({
    success: true,
    data: {
      role: 'school_admin',
      schoolId: 'school-1',
      permissions: [
        'schools:read',
        'schools:write',
        'classes:read',
        'classes:write',
        'teachers:read',
        'teachers:write',
        'subjects:read',
        'subjects:write',
        'classrooms:read',
        'classrooms:write',
        'timetables:read',
        'timetables:write',
        'timetables:generate',
        'constraints:read',
        'constraints:write',
        'users:read',
        'users:write',
      ],
      effectivePermissions: {
        isUnlimited: false,
        explicitPermissions: [],
        roleBasedPermissions: [
          'schools:read',
          'schools:write',
          'classes:read',
          'classes:write',
          'teachers:read',
          'teachers:write',
          'subjects:read',
          'subjects:write',
          'classrooms:read',
          'classrooms:write',
          'timetables:read',
          'timetables:write',
          'timetables:generate',
          'constraints:read',
          'constraints:write',
          'users:read',
          'users:write',
        ],
      },
    },
  })
})

// 認証設定情報取得
app.get('/auth/config', c => {
  return c.json({
    success: true,
    data: {
      domain: 'school-timetable.jp.auth0.com',
      audience: 'https://api.school-timetable.app',
      clientId: 'YmQjwwCNctZZpYm93DDVWUxAV5Hbpkja',
      configured: true,
      loginUrl: 'https://school-timetable.jp.auth0.com/authorize',
      logoutUrl: 'https://school-timetable.jp.auth0.com/v2/logout',
    },
  })
})

// 認証ヘルスチェック
app.get('/auth/health', c => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      auth0: {
        configured: true,
        domain: true,
        audience: true,
      },
      issues: [],
      timestamp: new Date().toISOString(),
    },
  })
})

// 教師情報API
// 1. 教師一覧取得
app.get('/api/frontend/school/teachers', async c => {
  try {
    const db = c.env.DB

    // teachersテーブルが存在しない場合は作成
    await db
      .prepare(`
      CREATE TABLE IF NOT EXISTS teachers (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL DEFAULT 'school-1',
        name TEXT NOT NULL,
        subjects TEXT DEFAULT '[]',
        grades TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
      .run()

    // 教師一覧を取得（orderフィールドでソート、nullの場合は名前順）
    const result = await db
      .prepare(`
      SELECT * FROM teachers WHERE school_id = ? 
      ORDER BY CASE WHEN \`order\` IS NULL THEN 1 ELSE 0 END, \`order\` ASC, name ASC
    `)
      .bind('school-1')
      .all()

    const teachers = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      subjects: row.subjects ? JSON.parse(row.subjects as string) : [],
      grades: row.grades ? JSON.parse(row.grades as string) : [],
      order: row.order !== null ? row.order as number : undefined,
    }))

    return c.json({
      success: true,
      data: teachers,
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 2. 教師新規作成
app.post('/api/frontend/school/teachers', async c => {
  try {
    const body = await c.req.json()
    const db = c.env.DB

    // teachersテーブルが存在しない場合は作成
    await db
      .prepare(`
      CREATE TABLE IF NOT EXISTS teachers (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL DEFAULT 'school-1',
        name TEXT NOT NULL,
        subjects TEXT DEFAULT '[]',
        grades TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
      .run()

    const teacherId = 'teacher-' + Date.now()
    const now = new Date().toISOString()

    await db
      .prepare(`
      INSERT INTO teachers (id, school_id, name, subjects, grades, \`order\`, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        teacherId,
        'school-1',
        body.name,
        JSON.stringify(body.subjects || []),
        JSON.stringify(body.grades || []),
        body.order !== undefined ? body.order : null,
        now,
        now
      )
      .run()

    return c.json({
      success: true,
      data: {
        id: teacherId,
        name: body.name,
        subjects: body.subjects || [],
        grades: body.grades || [],
        order: body.order !== undefined ? body.order : null,
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 3. 教師更新
app.put('/api/frontend/school/teachers/:id', async c => {
  try {
    const teacherId = c.req.param('id')
    const body = await c.req.json()
    const db = c.env.DB

    const now = new Date().toISOString()

    await db
      .prepare(`
      UPDATE teachers 
      SET name = ?, subjects = ?, grades = ?, \`order\` = ?, updated_at = ?
      WHERE id = ? AND school_id = ?
    `)
      .bind(
        body.name,
        JSON.stringify(body.subjects || []),
        JSON.stringify(body.grades || []),
        body.order !== undefined ? body.order : null,
        now,
        teacherId,
        'school-1'
      )
      .run()

    return c.json({
      success: true,
      data: {
        id: teacherId,
        name: body.name,
        subjects: body.subjects || [],
        grades: body.grades || [],
        order: body.order !== undefined ? body.order : null,
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 4. 教師削除
app.delete('/api/frontend/school/teachers/:id', async c => {
  try {
    const teacherId = c.req.param('id')
    const db = c.env.DB

    await db
      .prepare(`
      DELETE FROM teachers WHERE id = ? AND school_id = ?
    `)
      .bind(teacherId, 'school-1')
      .run()

    return c.json({
      success: true,
      data: null,
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 5. 教師一括保存
app.put('/api/frontend/school/teachers', async c => {
  try {
    const teachers = await c.req.json()
    const db = c.env.DB
    const now = new Date().toISOString()

    const savedTeachers = []

    for (const teacher of teachers) {
      if (teacher.id) {
        // 既存教師の更新
        await db
          .prepare(`
          UPDATE teachers 
          SET name = ?, subjects = ?, grades = ?, \`order\` = ?, updated_at = ?
          WHERE id = ? AND school_id = ?
        `)
          .bind(
            teacher.name,
            JSON.stringify(teacher.subjects || []),
            JSON.stringify(teacher.grades || []),
            teacher.order !== undefined ? teacher.order : null,
            now,
            teacher.id,
            'school-1'
          )
          .run()

        savedTeachers.push({
          id: teacher.id,
          name: teacher.name,
          subjects: teacher.subjects || [],
          grades: teacher.grades || [],
          order: teacher.order !== undefined ? teacher.order : null,
        })
      } else {
        // 新規教師の作成
        const teacherId = 'teacher-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)

        await db
          .prepare(`
          INSERT INTO teachers (id, school_id, name, subjects, grades, \`order\`, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
          .bind(
            teacherId,
            'school-1',
            teacher.name,
            JSON.stringify(teacher.subjects || []),
            JSON.stringify(teacher.grades || []),
            teacher.order !== undefined ? teacher.order : null,
            now,
            now
          )
          .run()

        savedTeachers.push({
          id: teacherId,
          name: teacher.name,
          subjects: teacher.subjects || [],
          grades: teacher.grades || [],
          order: teacher.order !== undefined ? teacher.order : null,
        })
      }
    }

    return c.json({
      success: true,
      data: savedTeachers,
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 教科情報API
// 1. 教科一覧取得
app.get('/api/frontend/school/subjects', async c => {
  try {
    const db = c.env.DB
    
    // subjectsテーブルが存在しない場合は作成
    await db
      .prepare(`
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL DEFAULT 'school-1',
        name TEXT NOT NULL,
        special_classroom TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
      .run()
    
    // 教科一覧を取得（orderフィールドでソート、nullの場合は名前順）
    const result = await db
      .prepare(`
      SELECT * FROM subjects WHERE school_id = ? 
      ORDER BY CASE WHEN \`order\` IS NULL THEN 1 ELSE 0 END, \`order\` ASC, name ASC
    `)
      .bind('school-1')
      .all()
    
    const subjects = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      specialClassroom: (row.special_classroom !== undefined ? row.special_classroom : null),
      weeklyLessons: row.weeklyLessons !== null ? row.weeklyLessons as number : 1,
      targetGrades: row.target_grades ? JSON.parse(row.target_grades as string) : [],
      order: row.order !== null ? row.order as number : undefined,
    }))
    
    return c.json({
      success: true,
      data: subjects,
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 2. 教科新規作成
app.post('/api/frontend/school/subjects', async c => {
  try {
    const body = await c.req.json()
    const db = c.env.DB
    
    // 必須フィールドのバリデーション
    if (!body.name || body.name.trim().length === 0) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['教科名は必須です'],
        },
        400
      )
    }
    
    if (body.name.length > 100) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['教科名は100文字以内で入力してください'],
        },
        400
      )
    }
    
    // weeklyLessonsのバリデーション
    if (body.weeklyLessons !== undefined) {
      if (typeof body.weeklyLessons !== 'number' || body.weeklyLessons < 1 || body.weeklyLessons > 10) {
        return c.json(
          {
            success: false,
            message: '入力データが不正です',
            errors: ['週間授業数は1〜10の数値で入力してください'],
          },
          400
        )
      }
    }
    
    // subjectsテーブルが存在しない場合は作成
    await db
      .prepare(`
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL DEFAULT 'school-1',
        name TEXT NOT NULL,
        special_classroom TEXT,
        weeklyLessons INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
      .run()
    
    // 重複チェック
    const existing = await db
      .prepare(`
      SELECT id FROM subjects WHERE school_id = ? AND name = ?
    `)
      .bind('school-1', body.name.trim())
      .first()
    
    if (existing) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['同じ教科名は既に登録されています'],
        },
        400
      )
    }
    
    const subjectId = 'subject-' + Date.now()
    const now = new Date().toISOString()
    
    await db
      .prepare(`
      INSERT INTO subjects (id, school_id, name, special_classroom, weeklyLessons, target_grades, \`order\`, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        subjectId,
        'school-1',
        body.name.trim(),
        body.specialClassroom?.trim() || null,
        body.weeklyLessons || 1,
        JSON.stringify(body.targetGrades || []),
        body.order !== undefined ? body.order : null,
        now,
        now
      )
      .run()
    
    return c.json({
      success: true,
      data: {
        id: subjectId,
        name: body.name.trim(),
        specialClassroom: body.specialClassroom?.trim() || null,
        weeklyLessons: body.weeklyLessons || 1,
        targetGrades: body.targetGrades || [],
        order: body.order !== undefined ? body.order : null,
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 3. 教科更新
app.put('/api/frontend/school/subjects/:id', async c => {
  try {
    const subjectId = c.req.param('id')
    const body = await c.req.json()
    const db = c.env.DB
    
    // 必須フィールドのバリデーション
    if (!body.name || body.name.trim().length === 0) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['教科名は必須です'],
        },
        400
      )
    }
    
    if (body.name.length > 100) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['教科名は100文字以内で入力してください'],
        },
        400
      )
    }
    
    // weeklyLessonsのバリデーション
    if (body.weeklyLessons !== undefined) {
      if (typeof body.weeklyLessons !== 'number' || body.weeklyLessons < 1 || body.weeklyLessons > 10) {
        return c.json(
          {
            success: false,
            message: '入力データが不正です',
            errors: ['週間授業数は1〜10の数値で入力してください'],
          },
          400
        )
      }
    }
    
    // 重複チェック（自分以外）
    const existing = await db
      .prepare(`
      SELECT id FROM subjects WHERE school_id = ? AND name = ? AND id != ?
    `)
      .bind('school-1', body.name.trim(), subjectId)
      .first()
    
    if (existing) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['同じ教科名は既に登録されています'],
        },
        400
      )
    }
    
    const now = new Date().toISOString()
    
    await db
      .prepare(`
      UPDATE subjects 
      SET name = ?, special_classroom = ?, weeklyLessons = ?, target_grades = ?, \`order\` = ?, updated_at = ?
      WHERE id = ? AND school_id = ?
    `)
      .bind(
        body.name.trim(),
        body.specialClassroom?.trim() || null,
        body.weeklyLessons || 1,
        JSON.stringify(body.targetGrades || []),
        body.order !== undefined ? body.order : null,
        now,
        subjectId,
        'school-1'
      )
      .run()
    
    return c.json({
      success: true,
      data: {
        id: subjectId,
        name: body.name.trim(),
        specialClassroom: body.specialClassroom?.trim() || null,
        weeklyLessons: body.weeklyLessons || 1,
        targetGrades: body.targetGrades || [],
        order: body.order !== undefined ? body.order : null,
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 4. 教科削除
app.delete('/api/frontend/school/subjects/:id', async c => {
  try {
    const subjectId = c.req.param('id')
    const db = c.env.DB
    
    await db
      .prepare(`
      DELETE FROM subjects WHERE id = ? AND school_id = ?
    `)
      .bind(subjectId, 'school-1')
      .run()
    
    return c.json({
      success: true,
      data: null,
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 5. 教科一括保存
app.put('/api/frontend/school/subjects', async c => {
  try {
    const subjects = await c.req.json()
    const db = c.env.DB
    const now = new Date().toISOString()
    
    const savedSubjects = []
    const errors: string[] = []
    
    // バリデーション
    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i]
      if (!subject.name || subject.name.trim().length === 0) {
        errors.push((i + 1) + '行目: 教科名は必須です')
      }
      if (subject.name && subject.name.length > 100) {
        errors.push((i + 1) + '行目: 教科名は100文字以内で入力してください')
      }
    }
    
    if (errors.length > 0) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors,
        },
        400
      )
    }
    
    for (const subject of subjects) {
      if (subject.id) {
        // 既存教科の更新
        // 重複チェック（自分以外）
        const existing = await db
          .prepare(`
          SELECT id FROM subjects WHERE school_id = ? AND name = ? AND id != ?
        `)
          .bind('school-1', subject.name.trim(), subject.id)
          .first()
        
        if (!existing) {
          await db
            .prepare(`
            UPDATE subjects 
            SET name = ?, special_classroom = ?, weeklyLessons = ?, target_grades = ?, \`order\` = ?, updated_at = ?
            WHERE id = ? AND school_id = ?
          `)
            .bind(
              subject.name.trim(),
              subject.specialClassroom?.trim() || null,
              subject.weeklyLessons || 1,
              JSON.stringify(subject.targetGrades || []),
              subject.order !== undefined ? subject.order : null,
              now,
              subject.id,
              'school-1'
            )
            .run()
          
          savedSubjects.push({
            id: subject.id,
            name: subject.name.trim(),
            specialClassroom: subject.specialClassroom?.trim() || null,
            weeklyLessons: subject.weeklyLessons || 1,
            targetGrades: subject.targetGrades || [],
            order: subject.order !== undefined ? subject.order : null,
          })
        }
      } else {
        // 新規教科の作成
        // 重複チェック
        const existing = await db
          .prepare(`
          SELECT id FROM subjects WHERE school_id = ? AND name = ?
        `)
          .bind('school-1', subject.name.trim())
          .first()
        
        if (!existing) {
          const subjectId = 'subject-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)
          
          await db
            .prepare(`
            INSERT INTO subjects (id, school_id, name, special_classroom, weeklyLessons, target_grades, \`order\`, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .bind(
              subjectId,
              'school-1',
              subject.name.trim(),
              subject.specialClassroom?.trim() || null,
              subject.weeklyLessons || 1,
              JSON.stringify(subject.targetGrades || []),
              subject.order !== undefined ? subject.order : null,
              now,
              now
            )
            .run()
          
          savedSubjects.push({
            id: subjectId,
            name: subject.name.trim(),
            specialClassroom: subject.specialClassroom?.trim() || null,
            weeklyLessons: subject.weeklyLessons || 1,
            targetGrades: subject.targetGrades || [],
            order: subject.order !== undefined ? subject.order : null,
          })
        }
      }
    }
    
    return c.json({
      success: true,
      data: savedSubjects,
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 教室情報API
// 1. 教室一覧取得
app.get('/api/frontend/school/classrooms', async c => {
  try {
    const db = c.env.DB
    
    // classroomsテーブルが存在しない場合は作成
    await db
      .prepare(`
      CREATE TABLE IF NOT EXISTS classrooms (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL DEFAULT 'school-1',
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
      .run()
    
    // 教室一覧を取得（orderフィールドでソート、nullの場合は名前順）
    const result = await db
      .prepare(`
      SELECT * FROM classrooms WHERE school_id = ? 
      ORDER BY CASE WHEN \`order\` IS NULL THEN 1 ELSE 0 END, \`order\` ASC, name ASC
    `)
      .bind('school-1')
      .all()
    
    const classrooms = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      count: row.count,
      order: row.order !== null ? row.order as number : undefined,
    }))
    
    return c.json({
      success: true,
      data: classrooms,
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 2. 教室新規作成
app.post('/api/frontend/school/classrooms', async c => {
  try {
    const body = await c.req.json()
    const db = c.env.DB
    
    // 必須フィールドのバリデーション
    if (!body.name || body.name.trim().length === 0) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['教室名は必須です'],
        },
        400
      )
    }
    
    if (!body.type || body.type.trim().length === 0) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['教室タイプは必須です'],
        },
        400
      )
    }
    
    if (!body.count || body.count < 1) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['教室数は1以上である必要があります'],
        },
        400
      )
    }
    
    if (body.name.length > 100) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['教室名は100文字以内で入力してください'],
        },
        400
      )
    }
    
    // classroomsテーブルが存在しない場合は作成
    await db
      .prepare(`
      CREATE TABLE IF NOT EXISTS classrooms (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL DEFAULT 'school-1',
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
      .run()
    
    // 重複チェック
    const existing = await db
      .prepare(`
      SELECT id FROM classrooms WHERE school_id = ? AND name = ?
    `)
      .bind('school-1', body.name.trim())
      .first()
    
    if (existing) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['同じ教室名は既に登録されています'],
        },
        400
      )
    }
    
    const classroomId = 'classroom-' + Date.now()
    const now = new Date().toISOString()
    
    await db
      .prepare(`
      INSERT INTO classrooms (id, school_id, name, type, count, \`order\`, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        classroomId,
        'school-1',
        body.name.trim(),
        body.type.trim(),
        parseInt(body.count) || 1,
        body.order !== undefined ? body.order : null,
        now,
        now
      )
      .run()
    
    return c.json({
      success: true,
      data: {
        id: classroomId,
        name: body.name.trim(),
        type: body.type.trim(),
        count: parseInt(body.count) || 1,
        order: body.order !== undefined ? body.order : null,
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 3. 教室更新
app.put('/api/frontend/school/classrooms/:id', async c => {
  try {
    const classroomId = c.req.param('id')
    const body = await c.req.json()
    const db = c.env.DB
    
    // 必須フィールドのバリデーション
    if (!body.name || body.name.trim().length === 0) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['教室名は必須です'],
        },
        400
      )
    }
    
    if (!body.type || body.type.trim().length === 0) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['教室タイプは必須です'],
        },
        400
      )
    }
    
    if (!body.count || body.count < 1) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['教室数は1以上である必要があります'],
        },
        400
      )
    }
    
    if (body.name.length > 100) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['教室名は100文字以内で入力してください'],
        },
        400
      )
    }
    
    // 重複チェック（自分以外）
    const existing = await db
      .prepare(`
      SELECT id FROM classrooms WHERE school_id = ? AND name = ? AND id != ?
    `)
      .bind('school-1', body.name.trim(), classroomId)
      .first()
    
    if (existing) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors: ['同じ教室名は既に登録されています'],
        },
        400
      )
    }
    
    const now = new Date().toISOString()
    
    await db
      .prepare(`
      UPDATE classrooms 
      SET name = ?, type = ?, count = ?, \`order\` = ?, updated_at = ?
      WHERE id = ? AND school_id = ?
    `)
      .bind(
        body.name.trim(),
        body.type.trim(),
        parseInt(body.count) || 1,
        body.order !== undefined ? body.order : null,
        now,
        classroomId,
        'school-1'
      )
      .run()
    
    return c.json({
      success: true,
      data: {
        id: classroomId,
        name: body.name.trim(),
        type: body.type.trim(),
        count: parseInt(body.count) || 1,
        order: body.order !== undefined ? body.order : null,
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 4. 教室削除
app.delete('/api/frontend/school/classrooms/:id', async c => {
  try {
    const classroomId = c.req.param('id')
    const db = c.env.DB
    
    await db
      .prepare(`
      DELETE FROM classrooms WHERE id = ? AND school_id = ?
    `)
      .bind(classroomId, 'school-1')
      .run()
    
    return c.json({
      success: true,
      data: null,
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 5. 教室一括保存
app.put('/api/frontend/school/classrooms', async c => {
  try {
    const classrooms = await c.req.json()
    const db = c.env.DB
    const now = new Date().toISOString()
    
    const savedClassrooms = []
    const errors: string[] = []
    
    // バリデーション
    for (let i = 0; i < classrooms.length; i++) {
      const classroom = classrooms[i]
      if (!classroom.name || classroom.name.trim().length === 0) {
        errors.push((i + 1) + '行目: 教室名は必須です')
      }
      if (!classroom.type || classroom.type.trim().length === 0) {
        errors.push((i + 1) + '行目: 教室タイプは必須です')
      }
      if (!classroom.count || classroom.count < 1) {
        errors.push((i + 1) + '行目: 教室数は1以上である必要があります')
      }
      if (classroom.name && classroom.name.length > 100) {
        errors.push((i + 1) + '行目: 教室名は100文字以内で入力してください')
      }
    }
    
    if (errors.length > 0) {
      return c.json(
        {
          success: false,
          message: '入力データが不正です',
          errors,
        },
        400
      )
    }
    
    for (const classroom of classrooms) {
      if (classroom.id) {
        // 既存教室の更新
        // 重複チェック（自分以外）
        const existing = await db
          .prepare(`
          SELECT id FROM classrooms WHERE school_id = ? AND name = ? AND id != ?
        `)
          .bind('school-1', classroom.name.trim(), classroom.id)
          .first()
        
        if (!existing) {
          await db
            .prepare(`
            UPDATE classrooms 
            SET name = ?, type = ?, count = ?, \`order\` = ?, updated_at = ?
            WHERE id = ? AND school_id = ?
          `)
            .bind(
              classroom.name.trim(),
              classroom.type.trim(),
              parseInt(classroom.count) || 1,
              classroom.order !== undefined ? classroom.order : null,
              now,
              classroom.id,
              'school-1'
            )
            .run()
          
          savedClassrooms.push({
            id: classroom.id,
            name: classroom.name.trim(),
            type: classroom.type.trim(),
            count: parseInt(classroom.count) || 1,
            order: classroom.order !== undefined ? classroom.order : null,
          })
        }
      } else {
        // 新規教室の作成
        // 重複チェック
        const existing = await db
          .prepare(`
          SELECT id FROM classrooms WHERE school_id = ? AND name = ?
        `)
          .bind('school-1', classroom.name.trim())
          .first()
        
        if (!existing) {
          const classroomId = 'classroom-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)
          
          await db
            .prepare(`
            INSERT INTO classrooms (id, school_id, name, type, count, \`order\`, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .bind(
              classroomId,
              'school-1',
              classroom.name.trim(),
              classroom.type.trim(),
              parseInt(classroom.count) || 1,
              classroom.order !== undefined ? classroom.order : null,
              now,
              now
            )
            .run()
          
          savedClassrooms.push({
            id: classroomId,
            name: classroom.name.trim(),
            type: classroom.type.trim(),
            count: parseInt(classroom.count) || 1,
            order: classroom.order !== undefined ? classroom.order : null,
          })
        }
      }
    }
    
    return c.json({
      success: true,
      data: savedClassrooms,
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 条件設定API
// 1. 条件設定取得
app.get('/api/frontend/school/conditions', async c => {
  try {
    const db = c.env.DB
    
    // school_conditionsテーブルが存在しない場合は作成
    await db
      .prepare(`
      CREATE TABLE IF NOT EXISTS school_conditions (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL DEFAULT 'school-1',
        conditions TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
      .run()
    
    // 条件設定を取得
    const result = await db
      .prepare(`
      SELECT * FROM school_conditions WHERE school_id = ? LIMIT 1
    `)
      .bind('school-1')
      .first()
    
    const conditions = result ? (result.conditions as string) || '' : ''
    
    return c.json({
      success: true,
      data: {
        conditions,
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// 2. 条件設定保存
app.put('/api/frontend/school/conditions', async c => {
  try {
    const body = await c.req.json()
    const db = c.env.DB
    
    // バリデーション
    if (body.conditions !== undefined && body.conditions !== null) {
      if (typeof body.conditions !== 'string') {
        return c.json(
          {
            success: false,
            message: '入力データが不正です',
            errors: ['条件設定は文字列である必要があります'],
          },
          400
        )
      }
      
      if (body.conditions.length > 10000) {
        return c.json(
          {
            success: false,
            message: '入力データが不正です',
            errors: ['条件設定は10000文字以内で入力してください'],
          },
          400
        )
      }
    }
    
    // school_conditionsテーブルが存在しない場合は作成
    await db
      .prepare(`
      CREATE TABLE IF NOT EXISTS school_conditions (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL DEFAULT 'school-1',
        conditions TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
      .run()
    
    const conditions = body.conditions || ''
    const now = new Date().toISOString()
    
    // 既存の条件設定を確認
    const existing = await db
      .prepare(`
      SELECT id FROM school_conditions WHERE school_id = ? LIMIT 1
    `)
      .bind('school-1')
      .first()
    
    if (existing) {
      // 更新
      await db
        .prepare(`
        UPDATE school_conditions 
        SET conditions = ?, updated_at = ?
        WHERE school_id = ?
      `)
        .bind(conditions, now, 'school-1')
        .run()
    } else {
      // 新規作成
      const conditionId = 'condition-' + Date.now()
      await db
        .prepare(`
        INSERT INTO school_conditions (id, school_id, conditions, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
        .bind(conditionId, 'school-1', conditions, now, now)
        .run()
    }
    
    return c.json({
      success: true,
      data: {
        conditions,
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: 'Database error: ' + (error as Error).message,
      },
      500
    )
  }
})

// デバッグ用: 教科情報確認API
app.get('/api/frontend/school/subjects/debug', async c => {
  try {
    const db = c.env.DB
    
    const subjectsResult = await db
      .prepare('SELECT * FROM subjects WHERE school_id = ? ORDER BY name')
      .bind('school-1')
      .all()
    
    const subjects = subjectsResult.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      weeklyLessons: row.weeklyLessons || 1,
      targetGrades: row.target_grades ? JSON.parse(row.target_grades as string) : []
    }))
    
    // 学年別教科リストを生成
    const subjectsByGrade = new Map()
    for (let grade = 1; grade <= 3; grade++) {
      const gradeSubjects = subjects.filter((s: any) => {
        if (!s.targetGrades || s.targetGrades.length === 0) {
          return true
        }
        return s.targetGrades.includes(grade)
      })
      subjectsByGrade.set(grade, gradeSubjects)
    }
    
    return c.json({
      success: true,
      data: {
        allSubjects: subjects,
        subjectsByGrade: Object.fromEntries(subjectsByGrade),
        totalCount: subjects.length
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500)
  }
})

// デバッグ用: クラス情報確認API
app.get('/api/frontend/school/classes/debug', async c => {
  try {
    const db = c.env.DB
    
    const classesResult = await db
      .prepare('SELECT * FROM classes WHERE school_id = ? ORDER BY grade, name')
      .bind('school-1')
      .all()
    
    let classes = classesResult.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      grade: row.grade,
      class: parseInt(row.name?.toString().replace(/\D/g, '') || '1')
    }))
    
    // クラスが存在しない場合、デフォルトクラスを生成
    if (classes.length === 0) {
      const defaultClasses = []
      for (let grade = 1; grade <= 3; grade++) {
        for (let classNum = 1; classNum <= 2; classNum++) {
          defaultClasses.push({
            id: 'class-' + grade + '-' + classNum,
            name: classNum + '組',
            grade: grade,
            class: classNum
          })
        }
      }
      classes = defaultClasses
    }
    
    return c.json({
      success: true,
      data: {
        rawData: classesResult.results,
        processedClasses: classes,
        count: classes.length
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500)
  }
})

// セッション管理用テーブル作成
async function createSessionTables(db: D1Database) {
  // セッション管理テーブル
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS generation_sessions (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL DEFAULT 'school-1',
      status TEXT NOT NULL DEFAULT 'in_progress',
      current_day TEXT,
      current_class_index INTEGER DEFAULT 0,
      total_steps INTEGER DEFAULT 36,
      completed_steps INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      error_count INTEGER DEFAULT 0,
      final_timetable_id TEXT
    )
  `).run()
  
  // 中間結果保存テーブル
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS generation_steps (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      day TEXT NOT NULL,
      class_id TEXT NOT NULL,
      grade INTEGER NOT NULL,
      class_number INTEGER NOT NULL,
      step_data TEXT NOT NULL,
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES generation_sessions(id)
    )
  `).run()
}

// 次のステップを実行する関数
async function executeNextStep(db: D1Database, groqApiKey: string, session: any) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  
  // データ収集
  const timetableData = await collectTimetableData(db)
  const classes = timetableData.classes
  
  // 現在の進行状況を計算
  const currentDayIndex = days.indexOf(session.current_day)
  const currentClassIndex = session.current_class_index
  
  if (currentDayIndex >= days.length) {
    // 全て完了
    return await completeSession(db, session.id)
  }
  
  const currentDay = days[currentDayIndex]
  const currentClass = classes[currentClassIndex]
  
  if (!currentClass) {
    // 現在の曜日のクラス処理完了、次の曜日へ
    const nextDayIndex = currentDayIndex + 1
    if (nextDayIndex >= days.length) {
      return await completeSession(db, session.id)
    }
    
    // 次の曜日に進む
    await db.prepare(`
      UPDATE generation_sessions 
      SET current_day = ?, current_class_index = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(days[nextDayIndex], session.id).run()
    
    return {
      sessionId: session.id,
      hasMore: true,
      progress: {
        current: session.completed_steps,
        total: session.total_steps,
        percentage: Math.round((session.completed_steps / session.total_steps) * 100),
        currentStep: days[nextDayIndex] + ' 開始'
      }
    }
  }
  
  try {
    // 単一ステップ生成
    const prompt = generateSingleStepPrompt(timetableData, currentDay, currentClass)
    const generatedStep = await generateTimetableWithGroq(prompt, groqApiKey, timetableData)
    
    // 検証
    const validationResult = validateTimetable(generatedStep, timetableData, true)
    
    if (!validationResult.isValid) {
      // エラーカウント増加
      const newErrorCount = (session.error_count || 0) + 1
      await db.prepare(`
        UPDATE generation_sessions 
        SET error_count = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(newErrorCount, session.id).run()
      
      if (newErrorCount >= 3) {
        // 最大エラー数に達したらスキップ
        return await skipToNextStep(db, session, currentDay, currentClass, classes.length)
      }
      
      return {
        sessionId: session.id,
        hasMore: true,
        progress: {
          current: session.completed_steps,
          total: session.total_steps,
          percentage: Math.round((session.completed_steps / session.total_steps) * 100),
          currentStep: currentDay + ' ' + currentClass.grade + '年' + currentClass.class + '組 リトライ中 (' + newErrorCount + '/3)'
        },
        error: validationResult.errors
      }
    }
    
    // 成功: ステップ結果を保存
    const stepId = 'step-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6)
    await db.prepare(`
      INSERT INTO generation_steps (id, session_id, day, class_id, grade, class_number, step_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      stepId, 
      session.id, 
      currentDay, 
      currentClass.id, 
      currentClass.grade, 
      currentClass.class, 
      JSON.stringify(generatedStep)
    ).run()
    
    // 次のステップに進む
    return await advanceToNextStep(db, session, classes.length)
    
  } catch (error) {
    // API エラー
    const newErrorCount = (session.error_count || 0) + 1
    await db.prepare(`
      UPDATE generation_sessions 
      SET error_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(newErrorCount, session.id).run()
    
    return {
      sessionId: session.id,
      hasMore: true,
      progress: {
        current: session.completed_steps,
        total: session.total_steps,
        percentage: Math.round((session.completed_steps / session.total_steps) * 100),
        currentStep: currentDay + ' ' + currentClass.grade + '年' + currentClass.class + '組 エラー (' + newErrorCount + '/3)'
      },
      error: (error as Error).message
    }
  }
}

// 次のステップに進む
async function advanceToNextStep(db: D1Database, session: any, totalClasses: number) {
  const nextClassIndex = session.current_class_index + 1
  const newCompletedSteps = session.completed_steps + 1
  
  await db.prepare(`
    UPDATE generation_sessions 
    SET current_class_index = ?, completed_steps = ?, error_count = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(nextClassIndex, newCompletedSteps, session.id).run()
  
  return {
    sessionId: session.id,
    hasMore: true,
    progress: {
      current: newCompletedSteps,
      total: session.total_steps,
      percentage: Math.round((newCompletedSteps / session.total_steps) * 100),
      currentStep: 'ステップ ' + newCompletedSteps + '/' + session.total_steps + ' 完了'
    }
  }
}

// ステップをスキップ
async function skipToNextStep(db: D1Database, session: any, currentDay: string, currentClass: any, totalClasses: number) {
  console.log('スキップ: ' + currentDay + ' ' + currentClass.grade + '年' + currentClass.class + '組')
  return await advanceToNextStep(db, session, totalClasses)
}

// セッション完了
async function completeSession(db: D1Database, sessionId: string) {
  // 全ステップデータを取得して最終時間割を構築
  const steps = await db.prepare(`
    SELECT day, class_id, grade, class_number, step_data 
    FROM generation_steps 
    WHERE session_id = ? 
    ORDER BY day, grade, class_number
  `).bind(sessionId).all()
  
  // 最終時間割をマージ
  const finalTimetable = mergeFinalTimetable(steps.results)
  
  // 時間割をDBに保存
  const timetableId = await saveTimetableToDatabase(db, finalTimetable)
  
  // セッション完了
  await db.prepare(`
    UPDATE generation_sessions 
    SET status = 'completed', final_timetable_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(timetableId, sessionId).run()
  
  return {
    sessionId,
    hasMore: false,
    progress: {
      current: 36,
      total: 36,
      percentage: 100,
      currentStep: "完了"
    },
    finalTimetableId: timetableId
  }
}

// 最終時間割をマージ
function mergeFinalTimetable(steps: any[]) {
  const timetable = {
    monday: [], tuesday: [], wednesday: [], 
    thursday: [], friday: [], saturday: []
  }
  
  for (const step of steps) {
    const stepData = JSON.parse(step.step_data)
    const daySchedule = stepData.timetable[step.day]
    
    if (!timetable[step.day]) {
      timetable[step.day] = daySchedule
    } else {
      // 各時限にクラスを追加
      daySchedule.forEach((period: any, periodIndex: number) => {
        if (!timetable[step.day][periodIndex]) {
          timetable[step.day][periodIndex] = { period: period.period, classes: [] }
        }
        timetable[step.day][periodIndex].classes.push(...period.classes)
      })
    }
  }
  
  return { timetable }
}

// 時間割生成開始API
app.post('/api/frontend/school/timetable/generate-start', async c => {
  try {
    const db = c.env.DB
    
    // テーブル作成
    await createSessionTables(db)
    
    // 新しいセッションを作成
    const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    const totalSteps = 6 * 6 // 6日 × 6クラス = 36ステップ
    
    await db.prepare(`
      INSERT INTO generation_sessions (id, status, total_steps, current_day, current_class_index)
      VALUES (?, 'in_progress', ?, 'monday', 0)
    `).bind(sessionId, totalSteps).run()
    
    return c.json({
      success: true,
      data: {
        sessionId,
        hasMore: true,
        progress: {
          current: 0,
          total: totalSteps,
          percentage: 0,
          currentStep: "セッション開始"
        }
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'セッション開始エラー: ' + (error as Error).message
    }, 500)
  }
})

// 時間割生成継続API
app.post('/api/frontend/school/timetable/generate-continue', async c => {
  try {
    const { sessionId } = await c.req.json()
    const db = c.env.DB
    const groqApiKey = c.env.GROQ_API_KEY
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: 'sessionId は必須です'
      }, 400)
    }
    
    // セッション情報を取得
    const session = await db.prepare('SELECT * FROM generation_sessions WHERE id = ?')
      .bind(sessionId).first()
    
    if (!session) {
      return c.json({
        success: false,
        message: 'セッションが見つかりません'
      }, 404)
    }
    
    if (session.status === 'completed') {
      return c.json({
        success: true,
        data: {
          sessionId,
          hasMore: false,
          progress: {
            current: session.total_steps,
            total: session.total_steps,
            percentage: 100,
            currentStep: "完了"
          },
          finalTimetableId: session.final_timetable_id
        }
      })
    }
    
    // 次のステップを実行
    const result = await executeNextStep(db, groqApiKey, session)
    
    return c.json({
      success: true,
      data: result
    })
    
  } catch (error) {
    return c.json({
      success: false,
      message: '継続実行エラー: ' + (error as Error).message
    }, 500)
  }
})

// 段階的時間割生成API（単一ステップ）- 非推奨
app.post('/api/frontend/school/timetable/generate-step', async c => {
  try {
    const body = await c.req.json()
    const { day, classId, existingTimetable } = body
    const db = c.env.DB
    const groqApiKey = c.env.GROQ_API_KEY
    
    if (!day || !classId) {
      return c.json({
        success: false,
        message: 'day と classId は必須です'
      }, 400)
    }
    
    // 1. データ収集
    const timetableData = await collectTimetableData(db)
    
    // 2. 対象クラスを特定
    const targetClass = timetableData.classes.find((cls: any) => cls.id === classId)
    if (!targetClass) {
      return c.json({
        success: false,
        message: 'クラス ' + classId + ' が見つかりません'
      }, 400)
    }
    
    // 3. 単一ステップ用プロンプト生成
    const prompt = generateSingleStepPrompt(timetableData, day, targetClass, existingTimetable)
    
    // 4. Groq APIで生成（単一ステップなので高速）
    const generatedStep = await generateTimetableWithGroq(prompt, groqApiKey, timetableData)
    
    // 5. 部分検証
    const validationResult = validateTimetable(generatedStep, timetableData, true)
    
    if (!validationResult.isValid) {
      return c.json({
        success: false,
        message: 'ステップ生成に失敗しました',
        errors: validationResult.errors,
        step: { day, classId },
        generatedStep
      }, 400)
    }
    
    return c.json({
      success: true,
      data: {
        step: { day, classId },
        generatedStep,
        validation: validationResult
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'ステップ生成エラー: ' + (error as Error).message,
    }, 500)
  }
})

// 従来の一括生成API（タイムアウト対策として非推奨）
app.post('/api/frontend/school/timetable/generate', async c => {
  try {
    const body = await c.req.json()
    const db = c.env.DB
    const groqApiKey = c.env.GROQ_API_KEY
    
    // 1. プロンプト生成用のデータを収集
    const timetableData = await collectTimetableData(db)
    
    // デバッグ用：収集したデータの内容をログ出力
    console.log('Collected timetable data:', {
      teachers: timetableData.teachers.length,
      subjects: timetableData.subjects.length,
      classrooms: timetableData.classrooms.length,
      teachersData: timetableData.teachers,
      subjectsData: timetableData.subjects,
      classroomsData: timetableData.classrooms
    })
    
    // 2. プロンプトを生成
    const prompt = generateTimetablePrompt(timetableData, body.options || {})
    
    // デバッグ用：プロンプトの内容をログ出力
    console.log('Generated prompt:', prompt)
    
    // 3. 制約チェック付きリトライ機能で時間割を生成
    let generatedTimetable = null
    let validationResult = null
    let attempts = 0
    const maxAttempts = 3
    
    while (attempts < maxAttempts) {
      attempts++
      console.log('=== 時間割生成試行 ' + attempts + '/' + maxAttempts + ' ===')
      
      try {
        // Groq APIで時間割を生成
        generatedTimetable = await generateTimetableWithGroq(prompt, groqApiKey, timetableData)
        
        // 制約チェック処理（旧API用は全体検証）
        validationResult = validateTimetable(generatedTimetable, timetableData, false)
        
        if (validationResult.isValid) {
          console.log('✅ 試行' + attempts + '回目で制約を満たす時間割が生成されました')
          break
        } else {
          console.log('❌ 試行' + attempts + '回目: 制約違反 ' + validationResult.errors.length + '件')
          console.log('制約違反詳細:', validationResult.errors)
          
          // 最大試行回数に達していない場合は続行
          if (attempts < maxAttempts) {
            console.log('⏳ ' + (attempts + 1) + '回目の試行を開始します...')
            await new Promise(resolve => setTimeout(resolve, 1000)) // 1秒待機
          }
        }
      } catch (error) {
        console.log('❌ 試行' + attempts + '回目でエラー発生:', (error as Error).message)
        if (attempts >= maxAttempts) {
          throw error
        }
        await new Promise(resolve => setTimeout(resolve, 2000)) // 2秒待機
      }
    }
    
    // 最終結果の判定
    if (!validationResult?.isValid) {
      return c.json({
        success: false,
        message: maxAttempts + '回の試行でも制約を満たす時間割を生成できませんでした',
        errors: validationResult?.errors || ['生成に失敗しました'],
        warnings: validationResult?.warnings || [],
        attempts: attempts,
        timetable: generatedTimetable
      }, 400)
    }
    
    // 4. DB保存
    const savedTimetable = await saveTimetableToDatabase(db, generatedTimetable)
    
    return c.json({
      success: true,
      data: {
        timetable: savedTimetable,
        metadata: {
          generatedAt: new Date().toISOString(),
          attempts: attempts,
          constraints: {
            errors: validationResult.errors.length,
            warnings: validationResult.warnings.length
          },
          dataUsed: {
            teachersCount: timetableData.teachers.length,
            subjectsCount: timetableData.subjects.length,
            classroomsCount: timetableData.classrooms.length,
          }
        },
        // デバッグ用：GroqからのJSONデータを含める
        debug: {
          originalGroqJson: generatedTimetable,
          promptUsed: prompt.substring(0, 500) + '...[truncated]',
          validationErrors: validationResult.errors,
          validationWarnings: validationResult.warnings
        }
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: '時間割生成エラー: ' + (error as Error).message,
    }, 500)
  }
})

// 時間割生成用のデータを収集する関数
async function collectTimetableData(db: D1Database) {
  // 学校設定を取得
  const schoolSettings = await db
    .prepare('SELECT * FROM school_settings WHERE id = ?')
    .bind('school-1')
    .first()
  
  // 教師情報を取得
  const teachersResult = await db
    .prepare('SELECT * FROM teachers WHERE school_id = ? ORDER BY CASE WHEN `order` IS NULL THEN 1 ELSE 0 END, `order` ASC, name ASC')
    .bind('school-1')
    .all()
  
  const teachers = teachersResult.results.map((row: Record<string, unknown>) => ({
    id: row.id,
    name: row.name,
    subjects: JSON.parse((row.subjects as string) || '[]'),
    grades: JSON.parse((row.grades as string) || '[]'),
    order: row.order !== null ? row.order as number : undefined,
  }))
  
  // 教科情報を取得
  const subjectsResult = await db
    .prepare('SELECT * FROM subjects WHERE school_id = ? ORDER BY CASE WHEN `order` IS NULL THEN 1 ELSE 0 END, `order` ASC, name ASC')
    .bind('school-1')
    .all()
  
  const subjects = subjectsResult.results.map((row: Record<string, unknown>) => ({
    id: row.id,
    name: row.name,
    specialClassroom: row.special_classroom || null,
    weeklyLessons: row.weeklyLessons || 1,
    targetGrades: row.target_grades ? JSON.parse(row.target_grades as string) : [],
    order: row.order !== null ? row.order as number : undefined,
  }))
  
  // 教室情報を取得
  const classroomsResult = await db
    .prepare('SELECT * FROM classrooms WHERE school_id = ? ORDER BY CASE WHEN `order` IS NULL THEN 1 ELSE 0 END, `order` ASC, name ASC')
    .bind('school-1')
    .all()
  
  const registeredClassrooms = classroomsResult.results.map((row: Record<string, unknown>) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    count: row.count || 1,
    order: row.order !== null ? row.order as number : undefined,
  }))

  // 普通教室を自動生成（各学年・各クラスの専用教室）
  const regularClassrooms = []
  const settings = schoolSettings || { grade1Classes: 2, grade2Classes: 2, grade3Classes: 2 }
  
  for (let grade = 1; grade <= 3; grade++) {
    const classCount = grade === 1 ? settings.grade1Classes : 
                      grade === 2 ? settings.grade2Classes : 
                      settings.grade3Classes
    
    for (let classNum = 1; classNum <= classCount; classNum++) {
      regularClassrooms.push({
        id: 'regular-' + grade + '-' + classNum,
        name: grade + '-' + classNum + '教室',
        type: '普通教室',
        count: 1,
        order: -1 // 普通教室を最初に表示
      })
    }
  }

  // 登録済み教室と自動生成教室を結合
  const classrooms = [...regularClassrooms, ...registeredClassrooms]
  
  // クラス情報を取得
  const classesResult = await db
    .prepare('SELECT * FROM classes WHERE school_id = ? ORDER BY grade, name')
    .bind('school-1')
    .all()
  
  let classes = classesResult.results.map((row: Record<string, unknown>) => ({
    id: row.id,
    name: row.name,
    grade: row.grade,
    class: parseInt(row.name?.toString().replace(/\D/g, '') || '1') // nameから数字部分を抽出してclass番号とする
  }))
  
  // クラスが存在しない場合、デフォルトクラスを生成
  if (classes.length === 0) {
    console.log('クラスが登録されていないため、デフォルトクラスを生成します')
    const defaultClasses = []
    for (let grade = 1; grade <= 3; grade++) {
      for (let classNum = 1; classNum <= 2; classNum++) {
        defaultClasses.push({
          id: 'class-' + grade + '-' + classNum,
          name: classNum + '組',
          grade: grade,
          class: classNum
        })
      }
    }
    classes = defaultClasses
    console.log('デフォルトクラス生成完了:', classes)
  }
  
  // 条件設定を取得
  const conditions = await db
    .prepare('SELECT conditions FROM school_conditions WHERE school_id = ?')
    .bind('school-1')
    .first()
  
  return {
    schoolSettings: schoolSettings || {
      grade1Classes: 2,
      grade2Classes: 2,
      grade3Classes: 2,
      dailyPeriods: 6,
      saturdayPeriods: 4
    },
    teachers,
    subjects,
    classrooms,
    classes,
    conditions: (conditions?.conditions as string) || ''
  }
}

// 単一ステップ用プロンプト生成関数
function generateSingleStepPrompt(data: any, day: string, targetClass: any, existingTimetable?: any) {
  const { schoolSettings, teachers, subjects, classrooms } = data
  
  // 対象学年の教科のみを抽出
  const gradeSubjects = subjects.filter((s: any) => {
    if (!s.targetGrades || s.targetGrades.length === 0) {
      return true // 全学年対象
    }
    return s.targetGrades.includes(targetClass.grade)
  })
  
  // 時間数設定
  const periodsCount = day === 'saturday' ? schoolSettings.saturdayPeriods : 6
  
  return `Generate ${day} schedule for single class: Grade${targetClass.grade}-Class${targetClass.class}

## Target
- Class: Grade${targetClass.grade}-Class${targetClass.class} (${targetClass.grade}年${targetClass.class}組)
- Day: ${day}
- Periods: ' + periodsCount + ' periods
- Constraint: Avoid consecutive same subjects

## Available Subjects for Grade ' + targetClass.grade + ':
' + gradeSubjects.map((s: any) => '- ' + s.name + ' (' + s.weeklyLessons + ' lessons/week)').join('\n') + '

## Available Teachers:
' + teachers.map((t: any) => '- ' + t.name + ': ' + (t.subjects ? t.subjects.join(', ') : 'any subject')).join('\n') + '

## Generation Rules:
1. Fill all ' + periodsCount + ' periods for this one class
2. Use appropriate subjects for Grade ' + targetClass.grade
3. Avoid consecutive same subjects
4. Match teachers to their capable subjects

## Output Format:
{
  "timetable": {
    "${day}": [
      {
        "period": 1,
        "classes": [
          {
            "grade": ${targetClass.grade},
            "class": ${targetClass.class},
            "subject": "[subject name]",
            "teacher": "[teacher name]",
            "classroom": "${targetClass.grade}-${targetClass.class}教室"
          }
        ]
      },
      ... (${periodsCount} periods total)
    ]
  }
}

Generate valid JSON only, no explanations.`
}

// プロンプトを生成する関数
function generateTimetablePrompt(data: any, options: any) {
  const { schoolSettings, teachers, subjects, classrooms, classes, conditions } = data
  
  // 日本語を英語キーワードにマッピング
  const subjectMap = new Map()
  const teacherMap = new Map()
  const classroomMap = new Map()
  
  // 教科マッピング
  subjects.forEach((s: any, i: number) => {
    const key = 'SUBJ' + (i + 1)
    subjectMap.set(s.name, key)
  })
  
  // 教師マッピング  
  teachers.forEach((t: any, i: number) => {
    const key = 'TCHR' + (i + 1)
    teacherMap.set(t.name, key)
  })
  
  // 教室マッピング
  classrooms.forEach((c: any, i: number) => {
    const key = 'ROOM' + (i + 1)
    classroomMap.set(c.name, key)
  })
  
  // 学年別教科リストを生成
  const subjectsByGrade = new Map()
  for (let grade = 1; grade <= 3; grade++) {
    const gradeSubjects = subjects.filter((s: any) => {
      if (!s.targetGrades || s.targetGrades.length === 0) {
        return true // targetGradesが未設定の場合は全学年対象とみなす
      }
      return s.targetGrades.includes(grade)
    })
    subjectsByGrade.set(grade, gradeSubjects)
  }
  
  return 'Generate complete weekly timetable for Japanese middle school.\n\n' +
    '## Target: Generate FULL WEEK SCHEDULE (Monday-Saturday)\n' +
    '- Classes: ' + classes.map((c: any) => 'Grade' + c.grade + '-Class' + c.class).join(', ') + '\n' +
    '- Days: Monday through Saturday\n' +
    '- Periods per day: Monday-Friday (6 periods), Saturday (4 periods)\n' +
    '- Total periods per class: 34 periods/week\n' +
    '- **KEY CONSTRAINT: No teacher can teach multiple classes simultaneously**\n\n' +
    '## Weekly Lesson Requirements by Grade:\n' + 
    Array.from(subjectsByGrade.entries()).map(([grade, gradeSubjects]: [number, any[]]) => 
      '**Grade ' + grade + ':**\n' + gradeSubjects.map((s: any) => '  - ' + s.name + ': ' + s.weeklyLessons + ' lessons/week').join('\n')
    ).join('\n\n') + '\n\n' +
    '## Available Teachers:\n' + 
    teachers.map((t: any) => '- ' + t.name + ': ' + (t.subjects ? t.subjects.join(', ') : 'any subject')).join('\n') + '\n\n' +
    '## Generation Rules:\n' +
    '1. **Teacher Constraint (CRITICAL):** Each period must have ' + classes.length + ' DIFFERENT teachers (one per class). Same teacher CANNOT teach multiple classes simultaneously.\n\n' +
    '2. **EXACT TEACHER ROTATION PATTERN:**\n' +
    'For each period, use this teacher rotation to avoid conflicts:\n' + 
    Array.from({length: 6}, (_, periodIndex) => 
      '**Period ' + (periodIndex + 1) + ':**\n' + classes.map((c: any, classIndex: number) => 
        '- Grade' + c.grade + '-Class' + c.class + ': ' + (teachers[(classIndex + periodIndex * classes.length) % teachers.length]?.name || '利用可能教師')
      ).join('\n')
    ).join('\n\n') + '\n\n' +
    '3. **Weekly Lesson Count:** Must match the required lessons per week for each subject.\n\n' +
    '4. **Subject Distribution:** Distribute subjects evenly across the week, avoid consecutive same subjects when possible.\n\n' +
    '5. **Grade-Subject Matching:** Only assign subjects that are appropriate for each grade level.\n\n' +
    '## Required Output Format:\n' +
    'Generate complete JSON with Monday through Saturday schedules:\n\n' +
    '{\n' +
    '  "timetable": {\n' +
    '    "monday": [\n' +
    '      {\n' +
    '        "period": 1,\n' +
    '        "classes": [\n' + 
    classes.map((c: any) => '          {\n            "grade": ' + c.grade + ',\n            "class": ' + c.class + ',\n            "subject": "[subject name]",\n            "teacher": "[teacher name]",\n            "classroom": "' + c.grade + '-' + c.class + '教室"\n          }').join(',\n') + '\n' +
    '        ]\n' +
    '      },\n' +
    '      { "period": 2, "classes": [...] },\n' +
    '      { "period": 3, "classes": [...] },\n' +
    '      { "period": 4, "classes": [...] },\n' +
    '      { "period": 5, "classes": [...] },\n' +
    '      { "period": 6, "classes": [...] }\n' +
    '    ],\n' +
    '    "tuesday": [\n' +
    '      { "period": 1, "classes": [...] },\n' +
    '      { "period": 2, "classes": [...] },\n' +
    '      { "period": 3, "classes": [...] },\n' +
    '      { "period": 4, "classes": [...] },\n' +
    '      { "period": 5, "classes": [...] },\n' +
    '      { "period": 6, "classes": [...] }\n' +
    '    ],\n' +
    '    "wednesday": [\n' +
    '      { "period": 1, "classes": [...] },\n' +
    '      { "period": 2, "classes": [...] },\n' +
    '      { "period": 3, "classes": [...] },\n' +
    '      { "period": 4, "classes": [...] },\n' +
    '      { "period": 5, "classes": [...] },\n' +
    '      { "period": 6, "classes": [...] }\n' +
    '    ],\n' +
    '    "thursday": [\n' +
    '      { "period": 1, "classes": [...] },\n' +
    '      { "period": 2, "classes": [...] },\n' +
    '      { "period": 3, "classes": [...] },\n' +
    '      { "period": 4, "classes": [...] },\n' +
    '      { "period": 5, "classes": [...] },\n' +
    '      { "period": 6, "classes": [...] }\n' +
    '    ],\n' +
    '    "friday": [\n' +
    '      { "period": 1, "classes": [...] },\n' +
    '      { "period": 2, "classes": [...] },\n' +
    '      { "period": 3, "classes": [...] },\n' +
    '      { "period": 4, "classes": [...] },\n' +
    '      { "period": 5, "classes": [...] },\n' +
    '      { "period": 6, "classes": [...] }\n' +
    '    ],\n' +
    '    "saturday": [\n' +
    '      { "period": 1, "classes": [...] },\n' +
    '      { "period": 2, "classes": [...] },\n' +
    '      { "period": 3, "classes": [...] },\n' +
    '      { "period": 4, "classes": [...] }\n' +
    '    ]\n' +
    '  }\n' +
    '}\n\n' +
    '**Generate valid JSON only, no explanations.**'
}

// Groq APIで時間割を生成する関数
async function generateTimetableWithGroq(prompt: string, apiKey: string, data: any) {
  // リトライ機能付きでGroq APIを呼び出し
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log('Groq API call attempt ' + attempt + '/3');
      
      // 高精度モデルを使用（DeepSeek R1 -> Llama 3.3 70B のフォールバック）
      const model = attempt === 1 ? 'deepseek-r1-distill-llama-70b' : 'llama-3.3-70b-versatile'
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are a precise timetable generator. Generate valid JSON only, no comments or explanations.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 32768,
          top_p: 0.9,
          response_format: { type: "json_object" }
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Groq API error on attempt ' + attempt + ': ' + response.status + ' ' + response.statusText)
        console.error('Error response body: ' + errorText)
        
        // 429 (Rate limit) や 503 エラーの場合はリトライ
        if (response.status === 429 || response.status === 503) {
          if (attempt < 3) {
            const delay = Math.pow(2, attempt) * 2000 // 4秒、8秒の遅延
            console.log('Rate limited or overloaded, waiting ' + delay + 'ms before retry...')
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
        }
        
        throw new Error('Groq API error: ' + response.status + ' ' + response.statusText + ' - ' + errorText)
      }
      
      // 成功した場合、レスポンス処理を実行
      const result = await response.json()
      const generatedText = result.choices[0].message.content
      
      // デバッグ用：生成されたテキストをログ出力
      console.log('=== GROQ GENERATED TEXT ===')
      console.log(generatedText)
      console.log('=== END GENERATED TEXT ===')
      
      // JSONを抽出して解析
      let jsonMatch = generatedText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('No JSON found in generated text:', generatedText)
        throw new Error('Gemini APIからの応答がJSON形式ではありません')
      }
      
      console.log('=== JSON MATCH ===')
      console.log(jsonMatch[0])
      console.log('=== END JSON MATCH ===')
      
      try {
        const parsed = JSON.parse(jsonMatch[0])
        console.log('Successfully parsed JSON:', parsed)
        
        // 英語キーワードを日本語に戻す処理
        const convertedResult = convertKeywordsToJapanese(parsed, data)
        return convertedResult
      } catch (parseError) {
        console.error('JSON parsing failed:', (parseError as Error).message)
        console.error('Attempting to fix JSON...')
        
        // JSONの修正を試行
        let fixedJson = jsonMatch[0]
        
        // 最初にコメントを削除（Geminiがコメント付きJSONを生成する場合がある）
        fixedJson = fixedJson.replace(/\/\/.*$/gm, '')  // 単行コメントを削除
        fixedJson = fixedJson.replace(/\/\*[\s\S]*?\*\//g, '')  // 複数行コメントを削除
        fixedJson = fixedJson.replace(/(".*?")|\/\/.*$/gm, '$1')  // インラインコメントを削除
        
        // 一般的なJSON修正
        fixedJson = fixedJson.replace(/,\s*}/g, '}')  // 末尾のカンマを削除
        fixedJson = fixedJson.replace(/,\s*]/g, ']')  // 配列末尾のカンマを削除
        
        // より包括的なプロパティ名修正（日本語、ハイフン、数字等を含む）
        // まず改行をスペースに正規化
        fixedJson = fixedJson.replace(/\n\s*/g, ' ')
        
        // 複数のパターンでプロパティ名を修正
        fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF-]*)\s*:/g, '$1"$2":')  // 基本パターン
        fixedJson = fixedJson.replace(/([{,]\s*)(\d+[a-zA-Z_$\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF-]+[a-zA-Z0-9_$\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF-]*)\s*:/g, '$1"$2":')  // 数字で始まるパターン
        fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z0-9_$\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF-]+)\s*:/g, '$1"$2":')  // 包括的パターン
        
        // より積極的な修正：改行や空白を考慮
        fixedJson = fixedJson.replace(/(\s+)([a-zA-Z_$][a-zA-Z0-9_$\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF-]*)\s*:/g, '$1"$2":')
        
        // 既にクォートされているものを重複修正しないように調整
        fixedJson = fixedJson.replace(/""([^"]+)""/g, '"$1"')  // 二重クォートを修正
        
        // 配列要素間のカンマ不足を修正
        fixedJson = fixedJson.replace(/("\s*}\s*)(\s*{)/g, '$1,$2')  // オブジェクト間にカンマを追加
        fixedJson = fixedJson.replace(/("\s*]\s*)(\s*\[)/g, '$1,$2')  // 配列間にカンマを追加
        fixedJson = fixedJson.replace(/(\d+)\s*(\s*{)/g, '$1,$2')     // 数値とオブジェクト間
        fixedJson = fixedJson.replace(/(}\s*)(\s*")/g, '$1,$2')      // オブジェクトと文字列間
        
        // 追加の強力なJSON修正
        fixedJson = fixedJson.replace(/(}\s*)(\s*[a-zA-Z_$])/g, '$1,"$2')  // オブジェクト後の裸のプロパティ名
        fixedJson = fixedJson.replace(/]\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '],"$1":')  // 配列後の裸のプロパティ名
        fixedJson = fixedJson.replace(/([a-zA-Z0-9_$]+)\s*:\s*([a-zA-Z0-9_$]+)(?=\s*[,}])/g, '"$1":"$2"')  // 値も裸の場合
        
        // 特殊ケース：改行やスペースが入った不正なプロパティ名
        fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z_$]\w*)\s+([a-zA-Z_$]\w*)\s*:/g, '$1"$2$3":')
        
        // 連続するカンマの修正
        fixedJson = fixedJson.replace(/,+/g, ',')  // 連続カンマを単一に
        fixedJson = fixedJson.replace(/,\s*,/g, ',')  // スペースを含む連続カンマ
        
        try {
          const fixedParsed = JSON.parse(fixedJson)
          console.log('Successfully parsed fixed JSON:', fixedParsed)
          
          // 英語キーワードを日本語に戻す処理
          const convertedResult = convertKeywordsToJapanese(fixedParsed, data)
          return convertedResult
        } catch (fixError) {
          console.error('Fixed JSON parsing also failed, trying aggressive repair...')
          
          // 最後の手段：位置ベースの修正
          const errorPosition = parseInt((fixError as Error).message.match(/position (\d+)/)?.[1] || '0')
          if (errorPosition > 0) {
            const beforeError = fixedJson.substring(0, errorPosition)
            const afterError = fixedJson.substring(errorPosition)
            
            // エラー位置周辺の文字を確認して修正
            let repairedJson = beforeError
            if (afterError.length > 0) {
              // 一般的な問題パターンを修正
              let fixedAfter = afterError
              fixedAfter = fixedAfter.replace(/^[^":{}\[\],]+/, '')  // 不正な文字を削除
              fixedAfter = fixedAfter.replace(/^([a-zA-Z_$]\w*)\s*:/, '"$1":')  // 裸のプロパティ名を修正
              repairedJson += fixedAfter
            }
            
            try {
              const repairedParsed = JSON.parse(repairedJson)
              console.log('Successfully parsed aggressively repaired JSON:', repairedParsed)
              const convertedResult = convertKeywordsToJapanese(repairedParsed, data)
              return convertedResult
            } catch (repairError) {
              console.error('Aggressive repair also failed:', (repairError as Error).message)
            }
          }
          console.error('Fixed JSON parsing also failed:', (fixError as Error).message)
          console.error('Original JSON:', jsonMatch[0])
          console.error('Fixed JSON:', fixedJson)
          
          // デバッグ用：JSONをレスポンスに含めてブラウザで確認できるように
          const debugInfo = {
            error: (fixError as Error).message,
            originalJson: jsonMatch[0].substring(0, 1000) + '...[truncated]',
            fixedJson: fixedJson.substring(0, 1000) + '...[truncated]',
            position: (fixError as Error).message.match(/position (\d+)/)?.[1] || 'unknown',
            line: (fixError as Error).message.match(/line (\d+)/)?.[1] || 'unknown'
          }
          
          throw new Error('生成されたJSONの解析に失敗しました: ' + (fixError as Error).message + '\n\nデバッグ情報: ' + JSON.stringify(debugInfo, null, 2))
        }
      }
      
      // 成功した場合はループを抜ける
      break
    } catch (error) {
      lastError = error as Error
      console.error('Attempt ' + attempt + ' failed:', error)
      
      if (attempt === 3) {
        throw lastError
      }
      
      // 最後の試行でない場合、少し待つ
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  // この行に到達することはないはずですが、型安全性のため
  throw new Error('Unexpected error in generateTimetableWithGroq')
}

// 英語キーワードを日本語に戻す変換関数
function convertKeywordsToJapanese(result: any, data: any) {
  const { teachers, subjects, classrooms } = data
  
  // マッピングを再構築
  const subjectMap = new Map()
  const teacherMap = new Map()
  const classroomMap = new Map()
  
  subjects.forEach((s: any, i: number) => {
    subjectMap.set('SUBJ' + (i + 1), s.name)
  })
  
  teachers.forEach((t: any, i: number) => {
    teacherMap.set('TCHR' + (i + 1), t.name)
  })
  
  classrooms.forEach((c: any, i: number) => {
    classroomMap.set('ROOM' + (i + 1), c.name)
  })
  
  // 時間割データを変換
  if (result.timetable) {
    Object.keys(result.timetable).forEach(day => {
      if (Array.isArray(result.timetable[day])) {
        result.timetable[day].forEach((period: any) => {
          if (period.classes && Array.isArray(period.classes)) {
            period.classes.forEach((classItem: any) => {
              // 教科名を変換
              if (classItem.subject && subjectMap.has(classItem.subject)) {
                classItem.subject = subjectMap.get(classItem.subject)
              }
              // 教師名を変換
              if (classItem.teacher && teacherMap.has(classItem.teacher)) {
                classItem.teacher = teacherMap.get(classItem.teacher)
              }
              // 教室名を変換
              if (classItem.classroom && classroomMap.has(classItem.classroom)) {
                classItem.classroom = classroomMap.get(classItem.classroom)
              }
            })
          }
        })
      }
    })
  }
  
  return result
}

// 制約チェック処理（段階的生成対応）
function validateTimetable(timetable: any, data: any, isPartialGeneration = false) {
  const errors: string[] = []
  const warnings: string[] = []
  
  // 基本的な構造チェック
  if (!timetable || !timetable.timetable) {
    errors.push('時間割データの構造が不正です')
    return { isValid: false, errors, warnings }
  }
  
  // 段階的生成時は部分検証のみ
  if (isPartialGeneration) {
    console.log('=== 部分検証モード（段階的生成） ===')
    return validatePartialTimetable(timetable, data)
  }
  
  const { teachers, subjects, classrooms, classes } = data
  const schedule = timetable.timetable
  
  // 1. 教師重複チェック
  console.log('=== 教師重複チェック開始 ===')
  for (const dayName of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']) {
    if (!schedule[dayName]) continue
    
    for (const period of schedule[dayName]) {
      const teacherSlots = new Map()
      
      if (period.classes && Array.isArray(period.classes)) {
        for (const classInfo of period.classes) {
          const teacher = classInfo.teacher
          const classId = 'Grade' + classInfo.grade + '-Class' + classInfo.class
          
          if (teacherSlots.has(teacher)) {
            errors.push(dayName + '第' + period.period + '限: ' + teacher + 'が複数クラス(' + teacherSlots.get(teacher) + ', ' + classId + ')に同時割当')
          } else {
            teacherSlots.set(teacher, classId)
          }
        }
      }
    }
  }
  
  // 2. 週当たり授業数チェック
  console.log('=== 週当たり授業数チェック開始 ===')
  const subjectCounts = new Map()
  
  // 各教科の期待授業数を設定
  const expectedLessons = new Map()
  subjects.forEach((subject: any) => {
    expectedLessons.set(subject.name, subject.weeklyLessons || 1)
  })
  
  // 実際の授業数をカウント
  for (const dayName of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']) {
    if (!schedule[dayName]) continue
    
    for (const period of schedule[dayName]) {
      if (period.classes && Array.isArray(period.classes)) {
        for (const classInfo of period.classes) {
          const key = classInfo.subject + '-Grade' + classInfo.grade + '-Class' + classInfo.class
          subjectCounts.set(key, (subjectCounts.get(key) || 0) + 1)
        }
      }
    }
  }
  
  // 授業数の検証（改善版）
  console.log('授業数カウント結果:', Array.from(subjectCounts.entries()))
  
  // 各クラスごとに全ての教科の授業数をチェック
  const requiredClasses = ['Grade1-Class1', 'Grade1-Class2', 'Grade2-Class1', 'Grade2-Class2', 'Grade3-Class1', 'Grade3-Class2']
  
  for (const classId of requiredClasses) {
    console.log('\n=== ' + classId + 'の授業数チェック ===')
    let totalLessonsForClass = 0
    
    subjects.forEach((subject: any) => {
      const grade = parseInt(classId.match(/Grade(\d+)/)?.[1] || '1')
      
      // 教科が対象学年に該当するかチェック
      if (subject.targetGrades && subject.targetGrades.length > 0 && !subject.targetGrades.includes(grade)) {
        return // この教科はこの学年に不要
      }
      
      const key = subject.name + '-' + classId
      const actualCount = subjectCounts.get(key) || 0
      const expectedCount = subject.weeklyLessons || 1
      
      totalLessonsForClass += actualCount
      
      if (actualCount !== expectedCount) {
        errors.push(key + ': 予定' + expectedCount + '時間 vs 実際' + actualCount + '時間')
        console.log('❌ ' + key + ': 予定' + expectedCount + ' vs 実際' + actualCount)
      } else {
        console.log('✅ ' + key + ': ' + actualCount + '時間 (正確)')
      }
    })
    
    // 総授業数チェック（平日30 + 土曜4 = 34）
    const expectedTotalLessons = 30 + 4 // TODO: schoolSettingsから取得
    if (totalLessonsForClass !== expectedTotalLessons) {
      warnings.push(classId + ': 総授業数 予定' + expectedTotalLessons + '時間 vs 実際' + totalLessonsForClass + '時間')
      console.log('⚠️ ' + classId + ': 総授業数 予定' + expectedTotalLessons + ' vs 実際' + totalLessonsForClass)
    }
  }
  
  // 3. 教室重複チェック
  console.log('=== 教室重複チェック開始 ===')
  for (const dayName of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']) {
    if (!schedule[dayName]) continue
    
    for (const period of schedule[dayName]) {
      const classroomSlots = new Map()
      
      if (period.classes && Array.isArray(period.classes)) {
        for (const classInfo of period.classes) {
          const classroom = classInfo.classroom
          const classId = 'Grade' + classInfo.grade + '-Class' + classInfo.class
          
          if (classroomSlots.has(classroom)) {
            warnings.push(dayName + '第' + period.period + '限: ' + classroom + 'が複数クラス(' + classroomSlots.get(classroom) + ', ' + classId + ')に同時割当')
          } else {
            classroomSlots.set(classroom, classId)
          }
        }
      }
    }
  }
  
  // 4. 全クラス存在チェック
  console.log('=== 全クラス存在チェック開始 ===')
  const requiredClassesForExistenceCheck = ['Grade1-Class1', 'Grade1-Class2', 'Grade2-Class1', 'Grade2-Class2', 'Grade3-Class1', 'Grade3-Class2']
  
  for (const dayName of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']) {
    if (!schedule[dayName]) {
      errors.push(dayName + 'の時間割が存在しません')
      continue
    }
    
    for (const period of schedule[dayName]) {
      if (!period.classes || !Array.isArray(period.classes)) {
        errors.push(dayName + '第' + period.period + '限のクラスデータが存在しません')
        continue
      }
      
      const foundClasses = period.classes.map((c: any) => 'Grade' + c.grade + '-Class' + c.class)
      const missingClasses = requiredClassesForExistenceCheck.filter(rc => !foundClasses.includes(rc))
      
      if (missingClasses.length > 0) {
        errors.push(dayName + '第' + period.period + '限: ' + missingClasses.join(', ') + 'が不足')
      }
    }
  }
  
  console.log('=== 検証完了: エラー' + errors.length + '件, 警告' + warnings.length + '件 ===')
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// 段階的生成用の部分検証関数
function validatePartialTimetable(timetable: any, data: any) {
  const errors: string[] = []
  const warnings: string[] = []
  
  const schedule = timetable.timetable
  
  // 1. 生成されたデータの基本構造チェック
  for (const dayName of Object.keys(schedule)) {
    if (!Array.isArray(schedule[dayName])) {
      errors.push(dayName + 'の時間割が配列ではありません')
      continue
    }
    
    for (const period of schedule[dayName]) {
      if (!period.period || !Array.isArray(period.classes)) {
        errors.push(dayName + '第' + (period.period || '?') + '限の構造が不正です')
        continue
      }
      
      // 各クラス情報の基本チェック
      for (const classInfo of period.classes) {
        if (!classInfo.grade || !classInfo.class || !classInfo.subject || !classInfo.teacher) {
          errors.push(dayName + '第' + period.period + '限: 必須フィールドが不足しています')
        }
      }
    }
  }
  
  // 2. 教師重複チェック（Phase 2 以降で重要）
  for (const dayName of Object.keys(schedule)) {
    const periods = schedule[dayName]
    
    for (const period of periods) {
      if (!period.classes || !Array.isArray(period.classes)) continue
      
      const teacherSlots = new Map()
      
      for (const classInfo of period.classes) {
        const teacher = classInfo.teacher
        const classId = 'Grade' + classInfo.grade + '-Class' + classInfo.class
        
        if (teacherSlots.has(teacher)) {
          errors.push(dayName + '第' + period.period + '限: ' + teacher + 'が複数クラス(' + teacherSlots.get(teacher) + ', ' + classId + ')に同時割当')
        } else {
          teacherSlots.set(teacher, classId)
        }
      }
    }
  }

  // 3. 生成された部分での連続同科目チェック（基本制約）
  for (const dayName of Object.keys(schedule)) {
    const periods = schedule[dayName]
    if (periods.length <= 1) continue
    
    for (let i = 0; i < periods.length - 1; i++) {
      const currentPeriod = periods[i]
      const nextPeriod = periods[i + 1]
      
      if (currentPeriod.classes && nextPeriod.classes) {
        for (const currentClass of currentPeriod.classes) {
          for (const nextClass of nextPeriod.classes) {
            if (currentClass.grade === nextClass.grade && 
                currentClass.class === nextClass.class &&
                currentClass.subject === nextClass.subject) {
              warnings.push(dayName + '第' + currentPeriod.period + '-' + nextPeriod.period + '限: Grade' + currentClass.grade + '-Class' + currentClass.class + 'で' + currentClass.subject + 'が連続')
            }
          }
        }
      }
    }
  }
  
  console.log('部分検証完了: エラー' + errors.length + '件, 警告' + warnings.length + '件')
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// DB保存機能
async function saveTimetableToDatabase(db: D1Database, timetable: any) {
  const timetableId = 'timetable-' + Date.now()
  const now = new Date().toISOString()
  
  // timetablesテーブルに保存
  await db
    .prepare(`
    INSERT INTO timetables (id, name, school_id, data, is_active, saturday_hours, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(timetableId, '時間割_' + new Date().toLocaleDateString('ja-JP'), 'school-1', JSON.stringify(timetable), 1, 4, now, now)
    .run()
  
  // 既存のschedulesを削除（新しい時間割で上書き）
  await db
    .prepare('DELETE FROM schedules WHERE timetable_id LIKE "timetable-%"')
    .run()
  
  // schedulesテーブルに詳細データを保存
  if (timetable.timetable) {
    const dayMapping = {
      monday: 1,
      tuesday: 2, 
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    }
    
    for (const [dayName, periods] of Object.entries(timetable.timetable)) {
      const dayOfWeek = dayMapping[dayName as keyof typeof dayMapping]
      if (!dayOfWeek || !Array.isArray(periods)) continue
      
      for (const period of periods) {
        if (!period.classes || !Array.isArray(period.classes)) continue
        
        for (const classInfo of period.classes) {
          // gradeとclass番号からclass_idを取得
          // classInfo.classは1,2,3のような数字、実際のクラス名は「1年A組」「2年A組」など
          const classResults = await db
            .prepare('SELECT id, name FROM classes WHERE school_id = ? AND grade = ?')
            .bind('school-1', classInfo.grade)
            .all()
          
          // 現在は1組目、2組目の概念で処理 
          let classResult = null
          if (classResults.results.length > 0) {
            const classIndex = (classInfo.class || 1) - 1 // 1-based to 0-based
            classResult = classResults.results[classIndex] || classResults.results[0]
          }
          
          if (!classResult) {
            console.warn('Class not found for grade ' + classInfo.grade + ', class ' + classInfo.class)
            continue
          }
          
          console.log('Saving schedule for class: ' + classResult.name + ' (' + classResult.id + '), period: ' + period.period)
          
          // 教師と教科、教室のIDを仮設定（実際の実装では名前からIDを取得）
          const scheduleId = timetableId + '-' + dayOfWeek + '-' + period.period + '-' + classResult.id
          
          await db
            .prepare(`
            INSERT INTO schedules (id, timetable_id, class_id, teacher_id, subject_id, classroom_id, day_of_week, period, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .bind(
              scheduleId,
              timetableId,
              classResult.id,
              'teacher-1', // 仮のteacher_id
              'subject-1', // 仮のsubject_id  
              'classroom-1', // 仮のclassroom_id
              dayOfWeek,
              period.period,
              now,
              now
            )
            .run()
        }
      }
    }
  }
  
  return {
    id: timetableId,
    ...timetable,
    createdAt: now
  }
}

// 時間割参照API
// 1. 時間割一覧取得
app.get('/api/frontend/school/timetables', async c => {
  try {
    const db = c.env.DB
    
    // 時間割一覧を取得
    const result = await db
      .prepare(`
        SELECT id, name, school_id, is_active, created_at, updated_at
        FROM timetables 
        WHERE school_id = ? 
        ORDER BY created_at DESC
      `)
      .bind('school-1')
      .all()
    
    const timetables = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      status: row.is_active ? 'active' : 'draft'
    }))
    
    return c.json({
      success: true,
      data: timetables
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Database error: ' + (error as Error).message
    }, 500)
  }
})

// 2. 時間割詳細取得
app.get('/api/frontend/school/timetables/:id', async c => {
  try {
    const timetableId = c.req.param('id')
    const db = c.env.DB
    
    // 時間割詳細を取得
    const result = await db
      .prepare(`
        SELECT id, name, school_id, is_active, data, created_at, updated_at
        FROM timetables 
        WHERE id = ? AND school_id = ?
      `)
      .bind(timetableId, 'school-1')
      .first()
    
    if (!result) {
      return c.json({
        success: false,
        message: '時間割が見つかりません'
      }, 404)
    }
    
    let timetableData = {}
    if (result.data) {
      try {
        timetableData = JSON.parse(result.data as string)
      } catch (error) {
        console.error('時間割データの解析エラー:', error)
      }
    }
    
    return c.json({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        createdAt: result.created_at,
        status: result.is_active ? 'active' : 'draft',
        timetable: timetableData
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Database error: ' + (error as Error).message
    }, 500)
  }
})

// 3. 時間割更新
app.put('/api/frontend/school/timetables/:id', async c => {
  try {
    const timetableId = c.req.param('id')
    const body = await c.req.json()
    const db = c.env.DB
    
    // バリデーション
    if (!body.name || body.name.trim().length === 0) {
      return c.json({
        success: false,
        message: '時間割名は必須です'
      }, 400)
    }
    
    const status = body.status === 'active' ? 1 : 0
    const now = new Date().toISOString()
    
    // 時間割を更新
    const result = await db
      .prepare(`
        UPDATE timetables 
        SET name = ?, is_active = ?, updated_at = ?
        WHERE id = ? AND school_id = ?
      `)
      .bind(body.name.trim(), status, now, timetableId, 'school-1')
      .run()
    
    if (result.changes === 0) {
      return c.json({
        success: false,
        message: '時間割が見つかりません'
      }, 404)
    }
    
    return c.json({
      success: true,
      data: {
        id: timetableId,
        name: body.name.trim(),
        status: body.status,
        updatedAt: now
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Database error: ' + (error as Error).message
    }, 500)
  }
})

// 4. 教師別時間割取得
app.get('/api/frontend/school/timetables/:id/teachers/:teacherName', async c => {
  try {
    const timetableId = c.req.param('id')
    const teacherName = decodeURIComponent(c.req.param('teacherName'))
    const db = c.env.DB
    
    // 時間割データを取得
    const result = await db
      .prepare(`
        SELECT data FROM timetables 
        WHERE id = ? AND school_id = ?
      `)
      .bind(timetableId, 'school-1')
      .first()
    
    if (!result || !result.data) {
      return c.json({
        success: false,
        message: '時間割が見つかりません'
      }, 404)
    }
    
    let timetableData
    try {
      timetableData = JSON.parse(result.data as string)
    } catch (error) {
      return c.json({
        success: false,
        message: '時間割データの解析エラー'
      }, 500)
    }
    
    // 教師別スケジュールを構築
    const schedule: Record<string, any[]> = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: []
    }
    
    // 各曜日の時間割から指定された教師のスケジュールを抽出
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    
    for (const day of dayNames) {
      if (timetableData.timetable && timetableData.timetable[day]) {
        for (const period of timetableData.timetable[day]) {
          for (const classInfo of period.classes) {
            if (classInfo.teacher === teacherName) {
              schedule[day].push({
                period: period.period,
                grade: classInfo.grade,
                class: classInfo.class,
                subject: classInfo.subject,
                classroom: classInfo.classroom
              })
            }
          }
        }
      }
    }
    
    return c.json({
      success: true,
      data: {
        teacherName,
        timetableId,
        schedule
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Database error: ' + (error as Error).message
    }, 500)
  }
})

// デバッグ用API：プロンプトを表示
app.get('/api/debug/timetable-prompt', async c => {
  try {
    const db = c.env.DB
    
    // データを収集
    const timetableData = await collectTimetableData(db)
    
    // プロンプトを生成
    const prompt = generateTimetablePrompt(timetableData, {})
    
    return c.json({
      success: true,
      data: {
        timetableData,
        prompt
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + (error as Error).message
    }, 500)
  }
})

// 学年別授業数分析API
app.get('/api/debug/lesson-analysis', async c => {
  try {
    const db = c.env.DB
    
    // データを収集
    const timetableData = await collectTimetableData(db)
    const { schoolSettings, subjects } = timetableData
    
    // 学年別分析
    const analysis = []
    
    for (let grade = 1; grade <= 3; grade++) {
      // この学年で利用可能な教科を取得
      const availableSubjects = subjects.filter(s => 
        !s.targetGrades || s.targetGrades.length === 0 || s.targetGrades.includes(grade)
      )
      
      // 必要授業数の計算
      const requiredLessons = availableSubjects.reduce((sum, s) => sum + s.weeklyLessons, 0)
      const availableSlots = schoolSettings.dailyPeriods * 5 + schoolSettings.saturdayPeriods
      
      analysis.push({
        grade,
        availableSubjects: availableSubjects.length,
        requiredLessons,
        availableSlots,
        utilizationRate: (requiredLessons / availableSlots * 100).toFixed(1) + '%',
        shortage: Math.max(0, availableSlots - requiredLessons),
        subjects: availableSubjects.map(s => ({
          name: s.name,
          weeklyLessons: s.weeklyLessons,
          targetGrades: s.targetGrades
        }))
      })
    }
    
    return c.json({
      success: true,
      data: {
        schoolSettings,
        analysis
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + (error as Error).message
    }, 500)
  }
})

// セッション式時間割生成API
// セッション作成
app.post('/api/frontend/session/create', async c => {
  try {
    const body = await c.req.json()
    const { schoolId } = body
    const db = c.env.DB
    
    if (!schoolId) {
      return c.json({
        success: false,
        message: 'schoolId is required'
      }, 400)
    }
    
    // セッション管理テーブルを作成
    await createSessionTables(db)
    
    // セッションIDを生成
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    
    // セッションを作成
    await db.prepare(`
      INSERT INTO generation_sessions (id, school_id, status, current_day, current_class_index, total_steps, completed_steps)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(sessionId, schoolId, 'in_progress', 'monday', 0, 36, 0).run()
    
    return c.json({
      success: true,
      sessionId,
      totalSteps: 36,
      message: 'セッションが作成されました'
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + (error as Error).message
    }, 500)
  }
})

// ステップ実行
app.post('/api/frontend/session/step', async c => {
  try {
    const body = await c.req.json()
    const { sessionId } = body
    const db = c.env.DB
    const groqApiKey = c.env.GROQ_API_KEY
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: 'sessionId is required'
      }, 400)
    }
    
    // セッション情報を取得
    const session = await db.prepare(`
      SELECT * FROM generation_sessions WHERE id = ?
    `).bind(sessionId).first()
    
    if (!session) {
      return c.json({
        success: false,
        message: 'セッションが見つかりません'
      }, 404)
    }
    
    if (session.status === 'completed') {
      return c.json({
        success: true,
        sessionId,
        completed: true,
        message: '生成完了済みです'
      })
    }
    
    // 次のステップを実行
    const result = await executeNextStep(db, groqApiKey, session)
    
    return c.json({
      success: true,
      sessionId,
      currentStep: result.completedSteps,
      totalSteps: result.totalSteps,
      progress: (result.completedSteps / result.totalSteps * 100),
      currentDay: result.currentDay,
      currentClass: result.currentClass,
      completed: result.completed,
      message: result.message
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + (error as Error).message
    }, 500)
  }
})

// セッション状況確認
app.get('/api/frontend/session/status/:sessionId', async c => {
  try {
    const sessionId = c.req.param('sessionId')
    const db = c.env.DB
    
    const session = await db.prepare(`
      SELECT * FROM generation_sessions WHERE id = ?
    `).bind(sessionId).first()
    
    if (!session) {
      return c.json({
        success: false,
        message: 'セッションが見つかりません'
      }, 404)
    }
    
    return c.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        currentDay: session.current_day,
        currentClassIndex: session.current_class_index,
        totalSteps: session.total_steps,
        completedSteps: session.completed_steps,
        progress: (session.completed_steps / session.total_steps * 100),
        created_at: session.created_at,
        updated_at: session.updated_at,
        error_count: session.error_count
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + (error as Error).message
    }, 500)
  }
})

// 最終結果取得
app.get('/api/frontend/session/result/:sessionId', async c => {
  try {
    const sessionId = c.req.param('sessionId')
    const db = c.env.DB
    
    const session = await db.prepare(`
      SELECT * FROM generation_sessions WHERE id = ?
    `).bind(sessionId).first()
    
    if (!session) {
      return c.json({
        success: false,
        message: 'セッションが見つかりません'
      }, 404)
    }
    
    if (session.status !== 'completed') {
      return c.json({
        success: false,
        message: '生成がまだ完了していません'
      }, 400)
    }
    
    // 最終時間割データを取得
    const timetable = await db.prepare(`
      SELECT * FROM timetables WHERE id = ?
    `).bind(session.final_timetable_id).first()
    
    if (!timetable) {
      return c.json({
        success: false,
        message: '時間割データが見つかりません'
      }, 404)
    }
    
    let timetableData = {}
    if (timetable.data) {
      try {
        timetableData = JSON.parse(timetable.data as string)
      } catch (error) {
        console.error('時間割データの解析エラー:', error)
      }
    }
    
    return c.json({
      success: true,
      timetable: {
        id: timetable.id,
        schoolId: timetable.school_id,
        generatedAt: timetable.created_at,
        timetable: timetableData
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + (error as Error).message
    }, 500)
  }
})

export default app
