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
        error: `Database error: ${(error as Error).message}`,
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

    // 教師一覧を取得
    const result = await db
      .prepare(`
      SELECT * FROM teachers WHERE school_id = ? ORDER BY created_at DESC
    `)
      .bind('school-1')
      .all()

    const teachers = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      subjects: row.subjects ? JSON.parse(row.subjects as string) : [],
      grades: row.grades ? JSON.parse(row.grades as string) : [],
    }))

    return c.json({
      success: true,
      data: teachers,
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: `Database error: ${(error as Error).message}`,
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

    const teacherId = `teacher-${Date.now()}`
    const now = new Date().toISOString()

    await db
      .prepare(`
      INSERT INTO teachers (id, school_id, name, subjects, grades, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        teacherId,
        'school-1',
        body.name,
        JSON.stringify(body.subjects || []),
        JSON.stringify(body.grades || []),
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
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: `Database error: ${(error as Error).message}`,
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
      SET name = ?, subjects = ?, grades = ?, updated_at = ?
      WHERE id = ? AND school_id = ?
    `)
      .bind(
        body.name,
        JSON.stringify(body.subjects || []),
        JSON.stringify(body.grades || []),
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
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: `Database error: ${(error as Error).message}`,
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
        message: `Database error: ${(error as Error).message}`,
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
          SET name = ?, subjects = ?, grades = ?, updated_at = ?
          WHERE id = ? AND school_id = ?
        `)
          .bind(
            teacher.name,
            JSON.stringify(teacher.subjects || []),
            JSON.stringify(teacher.grades || []),
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
        })
      } else {
        // 新規教師の作成
        const teacherId = `teacher-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

        await db
          .prepare(`
          INSERT INTO teachers (id, school_id, name, subjects, grades, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
          .bind(
            teacherId,
            'school-1',
            teacher.name,
            JSON.stringify(teacher.subjects || []),
            JSON.stringify(teacher.grades || []),
            now,
            now
          )
          .run()

        savedTeachers.push({
          id: teacherId,
          name: teacher.name,
          subjects: teacher.subjects || [],
          grades: teacher.grades || [],
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
        message: `Database error: ${(error as Error).message}`,
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
    
    // 既存のテーブルにspecial_classroomとdescriptionカラムを追加（存在しない場合）
    try {
      await db.prepare(`ALTER TABLE subjects ADD COLUMN special_classroom TEXT`).run()
    } catch (error) {
      // カラムが既に存在する場合は無視
    }
    
    try {
      await db.prepare(`ALTER TABLE subjects ADD COLUMN description TEXT`).run()
    } catch (error) {
      // カラムが既に存在する場合は無視
    }
    
    // テーブル構造を検証（PRAGMA table_info を使用してカラムの存在を確認）
    const tableInfo = await db.prepare(`PRAGMA table_info(subjects)`).all()
    const hasSpecialClassroom = tableInfo.results.some((col: any) => col.name === 'special_classroom')
    const hasDescription = tableInfo.results.some((col: any) => col.name === 'description')
    
    if (!hasSpecialClassroom || !hasDescription) {
      // カラムが存在しない場合は、テーブルを再作成
      console.log('Recreating subjects table due to schema mismatch')
      await db.prepare(`DROP TABLE IF EXISTS subjects`).run()
      await db.prepare(`
        CREATE TABLE subjects (
          id TEXT PRIMARY KEY,
          school_id TEXT NOT NULL DEFAULT 'school-1',
          name TEXT NOT NULL,
          special_classroom TEXT,
          description TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `).run()
    }
    
    // 教科一覧を取得
    const result = await db
      .prepare(`
      SELECT * FROM subjects WHERE school_id = ? ORDER BY created_at DESC
    `)
      .bind('school-1')
      .all()
    
    const subjects = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      specialClassroom: (row.special_classroom !== undefined ? row.special_classroom : null),
      description: (row.description !== undefined ? row.description : null),
    }))
    
    return c.json({
      success: true,
      data: subjects,
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: `Database error: ${(error as Error).message}`,
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
    
    // 既存のテーブルにspecial_classroomとdescriptionカラムを追加（存在しない場合）
    try {
      await db.prepare(`ALTER TABLE subjects ADD COLUMN special_classroom TEXT`).run()
    } catch (error) {
      // カラムが既に存在する場合は無視
    }
    
    try {
      await db.prepare(`ALTER TABLE subjects ADD COLUMN description TEXT`).run()
    } catch (error) {
      // カラムが既に存在する場合は無視
    }
    
    // テーブル構造を検証（PRAGMA table_info を使用してカラムの存在を確認）
    const tableInfo = await db.prepare(`PRAGMA table_info(subjects)`).all()
    const hasSpecialClassroom = tableInfo.results.some((col: any) => col.name === 'special_classroom')
    const hasDescription = tableInfo.results.some((col: any) => col.name === 'description')
    
    if (!hasSpecialClassroom || !hasDescription) {
      // カラムが存在しない場合は、テーブルを再作成
      console.log('Recreating subjects table due to schema mismatch')
      await db.prepare(`DROP TABLE IF EXISTS subjects`).run()
      await db.prepare(`
        CREATE TABLE subjects (
          id TEXT PRIMARY KEY,
          school_id TEXT NOT NULL DEFAULT 'school-1',
          name TEXT NOT NULL,
          special_classroom TEXT,
          description TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `).run()
    }
    
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
    
    const subjectId = `subject-${Date.now()}`
    const now = new Date().toISOString()
    
    await db
      .prepare(`
      INSERT INTO subjects (id, school_id, name, special_classroom, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        subjectId,
        'school-1',
        body.name.trim(),
        body.specialClassroom?.trim() || null,
        body.description?.trim() || null,
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
        description: body.description?.trim() || null,
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: `Database error: ${(error as Error).message}`,
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
      SET name = ?, special_classroom = ?, description = ?, updated_at = ?
      WHERE id = ? AND school_id = ?
    `)
      .bind(
        body.name.trim(),
        body.specialClassroom?.trim() || null,
        body.description?.trim() || null,
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
        description: body.description?.trim() || null,
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        message: `Database error: ${(error as Error).message}`,
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
        message: `Database error: ${(error as Error).message}`,
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
        errors.push(`${i + 1}行目: 教科名は必須です`)
      }
      if (subject.name && subject.name.length > 100) {
        errors.push(`${i + 1}行目: 教科名は100文字以内で入力してください`)
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
            SET name = ?, special_classroom = ?, description = ?, updated_at = ?
            WHERE id = ? AND school_id = ?
          `)
            .bind(
              subject.name.trim(),
              subject.specialClassroom?.trim() || null,
              subject.description?.trim() || null,
              now,
              subject.id,
              'school-1'
            )
            .run()
          
          savedSubjects.push({
            id: subject.id,
            name: subject.name.trim(),
            specialClassroom: subject.specialClassroom?.trim() || null,
            description: subject.description?.trim() || null,
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
          const subjectId = `subject-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
          
          await db
            .prepare(`
            INSERT INTO subjects (id, school_id, name, special_classroom, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
            .bind(
              subjectId,
              'school-1',
              subject.name.trim(),
              subject.specialClassroom?.trim() || null,
              subject.description?.trim() || null,
              now,
              now
            )
            .run()
          
          savedSubjects.push({
            id: subjectId,
            name: subject.name.trim(),
            specialClassroom: subject.specialClassroom?.trim() || null,
            description: subject.description?.trim() || null,
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
        message: `Database error: ${(error as Error).message}`,
      },
      500
    )
  }
})

export default app
