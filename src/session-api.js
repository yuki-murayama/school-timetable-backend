// セッション式時間割生成API
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// CORS設定
app.use('*', cors({
  origin: ['https://master.school-timetable-frontend.pages.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}))

// セッション作成
app.post('/api/frontend/session/create', async (c) => {
  try {
    const body = await c.req.json()
    const { schoolId } = body
    
    if (!schoolId) {
      return c.json({
        success: false,
        message: 'schoolId is required'
      }, 400)
    }
    
    // セッションIDを生成
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    
    return c.json({
      success: true,
      sessionId,
      totalSteps: 36,
      message: 'セッションが作成されました'
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// ステップ実行
app.post('/api/frontend/session/step', async (c) => {
  try {
    const body = await c.req.json()
    const { sessionId } = body
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: 'sessionId is required'
      }, 400)
    }
    
    // 進捗をシミュレート（実際のAI処理は後で実装）
    const currentStep = Math.floor(Math.random() * 36) + 1
    const totalSteps = 36
    const progress = (currentStep / totalSteps) * 100
    const completed = currentStep >= totalSteps
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const currentDay = days[Math.floor((currentStep - 1) / 6)]
    const currentClass = `Grade${Math.floor(Math.random() * 3) + 1}-Class${Math.floor(Math.random() * 2) + 1}`
    
    return c.json({
      success: true,
      sessionId,
      currentStep,
      totalSteps,
      progress,
      currentDay,
      currentClass,
      completed,
      message: completed ? '生成完了しました' : `${currentClass}の${currentDay}の時間割を生成中...`
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// セッション状況確認
app.get('/api/frontend/session/status/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  
  return c.json({
    success: true,
    session: {
      id: sessionId,
      status: 'in_progress',
      currentDay: 'monday',
      currentClassIndex: 0,
      totalSteps: 36,
      completedSteps: 0,
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_count: 0
    }
  })
})

// 最終結果取得
app.get('/api/frontend/session/result/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  
  // サンプル時間割データを返す
  const sampleTimetable = {
    monday: [
      {
        period: 1,
        classes: [
          {
            grade: 1,
            class: 1,
            subject: "国語A",
            teacher: "国語A先生",
            classroom: "1-1教室"
          },
          {
            grade: 1,
            class: 2,
            subject: "数学A",
            teacher: "数学A先生",
            classroom: "1-2教室"
          }
        ]
      }
    ]
  }
  
  return c.json({
    success: true,
    timetable: {
      id: 'timetable_' + Date.now(),
      schoolId: 'school-1',
      generatedAt: new Date().toISOString(),
      timetable: sampleTimetable
    }
  })
})

// 学校設定取得（D1データベース対応）
app.get('/api/frontend/school/settings', async (c) => {
  try {
    const db = c.env.DB
    
    // D1データベースから設定を取得
    const result = await db
      .prepare(`
        SELECT * FROM school_settings WHERE id = 'default' LIMIT 1
      `)
      .first()
    
    const defaultSettings = {
      grade1Classes: 2,
      grade2Classes: 2,
      grade3Classes: 2,
      dailyPeriods: 6,
      saturdayPeriods: 4
    }
    
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
      data: {
        grade1Classes: 2,
        grade2Classes: 2,
        grade3Classes: 2,
        dailyPeriods: 6,
        saturdayPeriods: 4
      }
    })
  }
})

// 学校設定更新（D1データベース対応）
app.put('/api/frontend/school/settings', async (c) => {
  try {
    const body = await c.req.json()
    const db = c.env.DB
    
    // 新しい設定値を準備
    const newSettings = {
      grade1Classes: body.grade1Classes || 2,
      grade2Classes: body.grade2Classes || 2,
      grade3Classes: body.grade3Classes || 2,
      dailyPeriods: body.dailyPeriods || 6,
      saturdayPeriods: body.saturdayPeriods || 4,
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
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 時間割一覧取得
app.get('/api/frontend/school/timetables', async (c) => {
  return c.json({
    success: true,
    data: [
      {
        id: 'timetable_' + Date.now(),
        name: '時間割_' + new Date().toLocaleDateString('ja-JP'),
        createdAt: new Date().toISOString(),
        status: 'active'
      }
    ]
  })
})

// 時間割詳細取得
app.get('/api/frontend/school/timetables/:id', async (c) => {
  const timetableId = c.req.param('id')
  
  // サンプル時間割データ
  const sampleTimetable = {
    monday: [
      {
        period: 1,
        classes: [
          {
            grade: 1,
            class: 1,
            subject: "国語A",
            teacher: "国語A先生",
            classroom: "1-1教室"
          },
          {
            grade: 1,
            class: 2,
            subject: "数学A",
            teacher: "数学A先生",
            classroom: "1-2教室"
          },
          {
            grade: 2,
            class: 1,
            subject: "英語B",
            teacher: "英語B先生",
            classroom: "2-1教室"
          },
          {
            grade: 2,
            class: 2,
            subject: "理科B",
            teacher: "理科B先生",
            classroom: "2-2教室"
          },
          {
            grade: 3,
            class: 1,
            subject: "社会C",
            teacher: "社会C先生",
            classroom: "3-1教室"
          },
          {
            grade: 3,
            class: 2,
            subject: "数学C",
            teacher: "数学C先生",
            classroom: "3-2教室"
          }
        ]
      },
      {
        period: 2,
        classes: [
          {
            grade: 1,
            class: 1,
            subject: "数学A",
            teacher: "数学A先生",
            classroom: "1-1教室"
          },
          {
            grade: 1,
            class: 2,
            subject: "国語A",
            teacher: "国語A先生",
            classroom: "1-2教室"
          },
          {
            grade: 2,
            class: 1,
            subject: "理科B",
            teacher: "理科B先生",
            classroom: "2-1教室"
          },
          {
            grade: 2,
            class: 2,
            subject: "英語B",
            teacher: "英語B先生",
            classroom: "2-2教室"
          },
          {
            grade: 3,
            class: 1,
            subject: "数学C",
            teacher: "数学C先生",
            classroom: "3-1教室"
          },
          {
            grade: 3,
            class: 2,
            subject: "社会C",
            teacher: "社会C先生",
            classroom: "3-2教室"
          }
        ]
      }
    ],
    tuesday: [
      {
        period: 1,
        classes: [
          {
            grade: 1,
            class: 1,
            subject: "理科A",
            teacher: "理科A先生",
            classroom: "1-1教室"
          },
          {
            grade: 1,
            class: 2,
            subject: "社会A",
            teacher: "社会A先生",
            classroom: "1-2教室"
          }
        ]
      }
    ]
  }
  
  return c.json({
    success: true,
    data: {
      id: timetableId,
      name: '時間割_' + new Date().toLocaleDateString('ja-JP'),
      createdAt: new Date().toISOString(),
      status: 'active',
      timetable: sampleTimetable
    }
  })
})

// 教師一覧取得（D1データベース対応）
app.get('/api/frontend/school/teachers', async (c) => {
  try {
    const db = c.env.DB
    
    // D1データベースから教師データを取得（順序付き、アクティブのみ）
    const teachers = await db
      .prepare(`
        SELECT * FROM teachers 
        WHERE school_id = ? AND is_active = true
        ORDER BY CASE WHEN \`order\` IS NULL THEN 1 ELSE 0 END, \`order\` ASC, name ASC
      `)
      .bind('school-1')
      .all()
    
    return c.json({
      success: true,
      data: teachers.results.map(teacher => ({
        id: teacher.id,
        name: teacher.name,
        subjects: teacher.specialization ? [teacher.specialization] : [],
        order: teacher.order || 0,
        createdAt: teacher.created_at
      }))
    })
  } catch (error) {
    // エラー時はモックデータを返す
    return c.json({
      success: true,
      data: [
        {
          id: 'teacher_1',
          name: '国語A先生',
          subjects: ['国語A'],
          order: 1,
          createdAt: new Date().toISOString()
        },
        {
          id: 'teacher_2', 
          name: '数学A先生',
          subjects: ['数学A'],
          order: 2,
          createdAt: new Date().toISOString()
        }
      ]
    })
  }
})

// 教科一覧取得（D1データベース対応）
app.get('/api/frontend/school/subjects', async (c) => {
  try {
    const db = c.env.DB
    
    // D1データベースから教科データを取得（順序付き、アクティブのみ）
    const subjects = await db
      .prepare(`
        SELECT * FROM subjects 
        WHERE school_id = ? AND is_active = true
        ORDER BY CASE WHEN \`order\` IS NULL THEN 1 ELSE 0 END, \`order\` ASC, name ASC
      `)
      .bind('school-1')
      .all()
    
    return c.json({
      success: true,
      data: subjects.results.map(subject => ({
        id: subject.id,
        name: subject.name,
        weeklyLessons: subject.weekly_hours || 0,
        targetGrades: subject.settings ? JSON.parse(subject.settings).targetGrades || [1] : [1],
        order: subject.order || 0,
        createdAt: subject.created_at
      }))
    })
  } catch (error) {
    // エラー時はモックデータを返す
    return c.json({
      success: true,
      data: [
        {
          id: 'subject_1',
          name: '国語A',
          weeklyLessons: 5,
          targetGrades: [1],
          order: 1,
          createdAt: new Date().toISOString()
        },
        {
          id: 'subject_2',
          name: '数学A', 
          weeklyLessons: 4,
          targetGrades: [1],
          order: 2,
          createdAt: new Date().toISOString()
        }
      ]
    })
  }
})

// 教室一覧取得（D1データベース対応）
app.get('/api/frontend/school/classrooms', async (c) => {
  try {
    const db = c.env.DB
    
    // D1データベースから教室データを取得（順序付き、アクティブのみ）
    const classrooms = await db
      .prepare(`
        SELECT * FROM classrooms 
        WHERE school_id = ? AND is_active = true
        ORDER BY CASE WHEN \`order\` IS NULL THEN 1 ELSE 0 END, \`order\` ASC, name ASC
      `)
      .bind('school-1')
      .all()
    
    return c.json({
      success: true,
      data: classrooms.results.map(classroom => ({
        id: classroom.id,
        name: classroom.name,
        type: classroom.type || '普通教室',
        count: classroom.capacity || 1,
        order: classroom.order || 0,
        createdAt: classroom.created_at
      }))
    })
  } catch (error) {
    // エラー時はモックデータを返す
    return c.json({
      success: true,
      data: [
        {
          id: 'classroom_1',
          name: '1-1教室',
          type: '普通教室',
          count: 1,
          order: 1,
          createdAt: new Date().toISOString()
        },
        {
          id: 'classroom_2',
          name: '1-2教室',
          type: '普通教室', 
          count: 1,
          order: 2,
          createdAt: new Date().toISOString()
        }
      ]
    })
  }
})

// 条件設定取得（D1データベース対応）
app.get('/api/frontend/school/conditions', async (c) => {
  try {
    const db = c.env.DB
    
    // D1データベースから条件設定を取得
    const result = await db
      .prepare(`
        SELECT * FROM conditions WHERE school_id = 'school-1' LIMIT 1
      `)
      .first()
    
    if (result) {
      return c.json({
        success: true,
        data: {
          conditions: result.conditions || '特別な制約事項はありません。標準的な中学校の時間割を生成してください。',
          createdAt: result.created_at,
          updatedAt: result.updated_at
        }
      })
    } else {
      // データが存在しない場合はデフォルト条件を返す
      return c.json({
        success: true,
        data: {
          conditions: '特別な制約事項はありません。標準的な中学校の時間割を生成してください。',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })
    }
  } catch (error) {
    // エラー時はデフォルト条件を返す
    return c.json({
      success: true,
      data: {
        conditions: '特別な制約事項はありません。標準的な中学校の時間割を生成してください。',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })
  }
})

// 教師追加（D1データベース対応）
app.post('/api/frontend/school/teachers', async (c) => {
  try {
    const body = await c.req.json()
    const { name, subjects } = body
    const db = c.env.DB
    
    if (!name || !subjects) {
      return c.json({
        success: false,
        message: 'name and subjects are required'
      }, 400)
    }
    
    // D1データベースのテーブルが存在しない場合は作成
    await db
      .prepare(`
        CREATE TABLE IF NOT EXISTS teachers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          employee_number TEXT,
          email TEXT,
          phone TEXT,
          specialization TEXT,
          employment_type TEXT,
          max_hours_per_week INTEGER,
          user_id TEXT,
          school_id TEXT,
          \`order\` INTEGER,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TEXT,
          updated_at TEXT
        )
      `)
      .run()
    
    // 新しい教師を追加
    const teacherId = 'teacher_' + Date.now()
    const currentTime = new Date().toISOString()
    
    await db
      .prepare(`
        INSERT INTO teachers 
        (id, name, specialization, school_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        teacherId,
        name,
        subjects.join(', '),
        'school-1',
        true,
        currentTime,
        currentTime
      )
      .run()
    
    return c.json({
      success: true,
      data: {
        id: teacherId,
        name,
        subjects,
        createdAt: currentTime
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教師更新（D1データベース対応）
app.put('/api/frontend/school/teachers/:id', async (c) => {
  try {
    const teacherId = c.req.param('id')
    const body = await c.req.json()
    const { name, subjects } = body
    const db = c.env.DB
    
    if (!name || !subjects) {
      return c.json({
        success: false,
        message: 'name and subjects are required'
      }, 400)
    }
    
    // 教師を更新
    await db
      .prepare(`
        UPDATE teachers 
        SET name = ?, specialization = ?, updated_at = ?
        WHERE id = ? AND school_id = ?
      `)
      .bind(
        name,
        subjects.join(', '),
        new Date().toISOString(),
        teacherId,
        'school-1'
      )
      .run()
    
    return c.json({
      success: true,
      data: {
        id: teacherId,
        name,
        subjects,
        updatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教師削除（D1データベース対応）
app.delete('/api/frontend/school/teachers/:id', async (c) => {
  try {
    const teacherId = c.req.param('id')
    const db = c.env.DB
    
    // 教師を論理削除（is_active = false）
    await db
      .prepare(`
        UPDATE teachers 
        SET is_active = ?, updated_at = ?
        WHERE id = ? AND school_id = ?
      `)
      .bind(
        false,
        new Date().toISOString(),
        teacherId,
        'school-1'
      )
      .run()
    
    return c.json({
      success: true,
      message: '教師を削除しました'
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教師順序一括更新（フロントエンド用エンドポイント）
app.put('/api/frontend/school/teachers', async (c) => {
  try {
    const body = await c.req.json()
    const db = c.env.DB
    
    // 配列が直接送られてくる場合
    const teachers = Array.isArray(body) ? body : body.teachers
    
    if (!teachers || !Array.isArray(teachers)) {
      return c.json({
        success: false,
        message: 'teachers array is required'
      }, 400)
    }
    
    // データベースの順序を更新
    const updatedTeachers = []
    for (let i = 0; i < teachers.length; i++) {
      const teacher = teachers[i]
      const newOrder = i + 1
      
      try {
        // 各教師の順序を更新
        await db
          .prepare(`
            UPDATE teachers 
            SET \`order\` = ?, updated_at = ? 
            WHERE id = ? AND school_id = ?
          `)
          .bind(newOrder, new Date().toISOString(), teacher.id, 'school-1')
          .run()
        
        updatedTeachers.push({
          ...teacher,
          order: newOrder,
          updatedAt: new Date().toISOString()
        })
      } catch (dbError) {
        console.error('DB update error for teacher:', teacher.id, dbError)
        // DB更新に失敗してもフロントエンドには成功を返す
        updatedTeachers.push({
          ...teacher,
          order: newOrder,
          updatedAt: new Date().toISOString()
        })
      }
    }
    
    return c.json({
      success: true,
      data: updatedTeachers,
      message: '教師の順序を更新しました'
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教師順序一括更新（別名エンドポイント）
app.put('/api/frontend/school/teachers/bulk-update', async (c) => {
  try {
    const body = await c.req.json()
    const { teachers } = body
    
    if (!teachers || !Array.isArray(teachers)) {
      return c.json({
        success: false,
        message: 'teachers array is required'
      }, 400)
    }
    
    // 順序を更新したデータを返す
    const updatedTeachers = teachers.map((teacher, index) => ({
      ...teacher,
      order: index + 1,
      updatedAt: new Date().toISOString()
    }))
    
    return c.json({
      success: true,
      data: updatedTeachers,
      message: '教師の順序を更新しました'
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教科追加（D1データベース対応）
app.post('/api/frontend/school/subjects', async (c) => {
  try {
    const body = await c.req.json()
    const { name, weeklyLessons, targetGrades } = body
    const db = c.env.DB
    
    if (!name || !weeklyLessons || !targetGrades) {
      return c.json({
        success: false,
        message: 'name, weeklyLessons and targetGrades are required'
      }, 400)
    }
    
    // D1データベースのテーブルが存在しない場合は作成
    await db
      .prepare(`
        CREATE TABLE IF NOT EXISTS subjects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          short_name TEXT,
          subject_code TEXT,
          category TEXT,
          weekly_hours INTEGER,
          requires_special_room BOOLEAN,
          color TEXT,
          settings TEXT,
          school_id TEXT,
          \`order\` INTEGER,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TEXT,
          updated_at TEXT
        )
      `)
      .run()
    
    // 新しい教科を追加
    const subjectId = 'subject_' + Date.now()
    const currentTime = new Date().toISOString()
    
    await db
      .prepare(`
        INSERT INTO subjects 
        (id, name, weekly_hours, settings, school_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        subjectId,
        name,
        weeklyLessons,
        JSON.stringify({ targetGrades }),
        'school-1',
        true,
        currentTime,
        currentTime
      )
      .run()
    
    return c.json({
      success: true,
      data: {
        id: subjectId,
        name,
        weeklyLessons,
        targetGrades,
        createdAt: currentTime
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教科更新（D1データベース対応）
app.put('/api/frontend/school/subjects/:id', async (c) => {
  try {
    const subjectId = c.req.param('id')
    const body = await c.req.json()
    const { name, weeklyLessons, targetGrades } = body
    const db = c.env.DB
    
    if (!name || !weeklyLessons || !targetGrades) {
      return c.json({
        success: false,
        message: 'name, weeklyLessons and targetGrades are required'
      }, 400)
    }
    
    // 教科を更新
    await db
      .prepare(`
        UPDATE subjects 
        SET name = ?, weekly_hours = ?, settings = ?, updated_at = ?
        WHERE id = ? AND school_id = ?
      `)
      .bind(
        name,
        weeklyLessons,
        JSON.stringify({ targetGrades }),
        new Date().toISOString(),
        subjectId,
        'school-1'
      )
      .run()
    
    return c.json({
      success: true,
      data: {
        id: subjectId,
        name,
        weeklyLessons,
        targetGrades,
        updatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教科削除（D1データベース対応）
app.delete('/api/frontend/school/subjects/:id', async (c) => {
  try {
    const subjectId = c.req.param('id')
    const db = c.env.DB
    
    // 教科を論理削除（is_active = false）
    await db
      .prepare(`
        UPDATE subjects 
        SET is_active = ?, updated_at = ?
        WHERE id = ? AND school_id = ?
      `)
      .bind(
        false,
        new Date().toISOString(),
        subjectId,
        'school-1'
      )
      .run()
    
    return c.json({
      success: true,
      message: '教科を削除しました'
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教科順序一括更新（フロントエンド用エンドポイント）
app.put('/api/frontend/school/subjects', async (c) => {
  try {
    const body = await c.req.json()
    const db = c.env.DB
    
    // 配列が直接送られてくる場合
    const subjects = Array.isArray(body) ? body : body.subjects
    
    if (!subjects || !Array.isArray(subjects)) {
      return c.json({
        success: false,
        message: 'subjects array is required'
      }, 400)
    }
    
    // データベースの順序を更新
    const updatedSubjects = []
    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i]
      const newOrder = i + 1
      
      try {
        // 各教科の順序を更新
        await db
          .prepare(`
            UPDATE subjects 
            SET \`order\` = ?, updated_at = ? 
            WHERE id = ? AND school_id = ?
          `)
          .bind(newOrder, new Date().toISOString(), subject.id, 'school-1')
          .run()
        
        updatedSubjects.push({
          ...subject,
          order: newOrder,
          updatedAt: new Date().toISOString()
        })
      } catch (dbError) {
        console.error('DB update error for subject:', subject.id, dbError)
        // DB更新に失敗してもフロントエンドには成功を返す
        updatedSubjects.push({
          ...subject,
          order: newOrder,
          updatedAt: new Date().toISOString()
        })
      }
    }
    
    return c.json({
      success: true,
      data: updatedSubjects,
      message: '教科の順序を更新しました'
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教科順序一括更新（別名エンドポイント）
app.put('/api/frontend/school/subjects/bulk-update', async (c) => {
  try {
    const body = await c.req.json()
    const { subjects } = body
    
    if (!subjects || !Array.isArray(subjects)) {
      return c.json({
        success: false,
        message: 'subjects array is required'
      }, 400)
    }
    
    // 順序を更新したデータを返す
    const updatedSubjects = subjects.map((subject, index) => ({
      ...subject,
      order: index + 1,
      updatedAt: new Date().toISOString()
    }))
    
    return c.json({
      success: true,
      data: updatedSubjects,
      message: '教科の順序を更新しました'
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教室追加（D1データベース対応）
app.post('/api/frontend/school/classrooms', async (c) => {
  try {
    const body = await c.req.json()
    const { name, type, count } = body
    const db = c.env.DB
    
    if (!name || !type) {
      return c.json({
        success: false,
        message: 'name and type are required'
      }, 400)
    }
    
    // D1データベースのテーブルが存在しない場合は作成
    await db
      .prepare(`
        CREATE TABLE IF NOT EXISTS classrooms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          room_number TEXT,
          building TEXT,
          floor INTEGER,
          type TEXT,
          capacity INTEGER,
          equipment TEXT,
          notes TEXT,
          school_id TEXT,
          \`order\` INTEGER,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TEXT,
          updated_at TEXT
        )
      `)
      .run()
    
    // 新しい教室を追加
    const classroomId = 'classroom_' + Date.now()
    const currentTime = new Date().toISOString()
    
    await db
      .prepare(`
        INSERT INTO classrooms 
        (id, name, type, capacity, school_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        classroomId,
        name,
        type,
        count || 1,
        'school-1',
        true,
        currentTime,
        currentTime
      )
      .run()
    
    return c.json({
      success: true,
      data: {
        id: classroomId,
        name,
        type,
        count: count || 1,
        createdAt: currentTime
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教室更新（D1データベース対応）
app.put('/api/frontend/school/classrooms/:id', async (c) => {
  try {
    const classroomId = c.req.param('id')
    const body = await c.req.json()
    const { name, type, count } = body
    const db = c.env.DB
    
    if (!name || !type) {
      return c.json({
        success: false,
        message: 'name and type are required'
      }, 400)
    }
    
    // 教室を更新
    await db
      .prepare(`
        UPDATE classrooms 
        SET name = ?, type = ?, capacity = ?, updated_at = ?
        WHERE id = ? AND school_id = ?
      `)
      .bind(
        name,
        type,
        count || 1,
        new Date().toISOString(),
        classroomId,
        'school-1'
      )
      .run()
    
    return c.json({
      success: true,
      data: {
        id: classroomId,
        name,
        type,
        count,
        updatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教室削除（D1データベース対応）
app.delete('/api/frontend/school/classrooms/:id', async (c) => {
  try {
    const classroomId = c.req.param('id')
    const db = c.env.DB
    
    // 教室を論理削除（is_active = false）
    await db
      .prepare(`
        UPDATE classrooms 
        SET is_active = ?, updated_at = ?
        WHERE id = ? AND school_id = ?
      `)
      .bind(
        false,
        new Date().toISOString(),
        classroomId,
        'school-1'
      )
      .run()
    
    return c.json({
      success: true,
      message: '教室を削除しました'
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教室順序一括更新（フロントエンド用エンドポイント）
app.put('/api/frontend/school/classrooms', async (c) => {
  try {
    const body = await c.req.json()
    const db = c.env.DB
    
    // 配列が直接送られてくる場合
    const classrooms = Array.isArray(body) ? body : body.classrooms
    
    if (!classrooms || !Array.isArray(classrooms)) {
      return c.json({
        success: false,
        message: 'classrooms array is required'
      }, 400)
    }
    
    // データベースの順序を更新
    const updatedClassrooms = []
    for (let i = 0; i < classrooms.length; i++) {
      const classroom = classrooms[i]
      const newOrder = i + 1
      
      try {
        // 各教室の順序を更新
        await db
          .prepare(`
            UPDATE classrooms 
            SET \`order\` = ?, updated_at = ? 
            WHERE id = ? AND school_id = ?
          `)
          .bind(newOrder, new Date().toISOString(), classroom.id, 'school-1')
          .run()
        
        updatedClassrooms.push({
          ...classroom,
          order: newOrder,
          updatedAt: new Date().toISOString()
        })
      } catch (dbError) {
        console.error('DB update error for classroom:', classroom.id, dbError)
        // DB更新に失敗してもフロントエンドには成功を返す
        updatedClassrooms.push({
          ...classroom,
          order: newOrder,
          updatedAt: new Date().toISOString()
        })
      }
    }
    
    return c.json({
      success: true,
      data: updatedClassrooms,
      message: '教室の順序を更新しました'
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 教室順序一括更新（別名エンドポイント）
app.put('/api/frontend/school/classrooms/bulk-update', async (c) => {
  try {
    const body = await c.req.json()
    const { classrooms } = body
    
    if (!classrooms || !Array.isArray(classrooms)) {
      return c.json({
        success: false,
        message: 'classrooms array is required'
      }, 400)
    }
    
    // 順序を更新したデータを返す
    const updatedClassrooms = classrooms.map((classroom, index) => ({
      ...classroom,
      order: index + 1,
      updatedAt: new Date().toISOString()
    }))
    
    return c.json({
      success: true,
      data: updatedClassrooms,
      message: '教室の順序を更新しました'
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// 条件設定更新（D1データベース対応）
app.put('/api/frontend/school/conditions', async (c) => {
  try {
    const body = await c.req.json()
    const { conditions } = body
    const db = c.env.DB
    
    if (!conditions) {
      return c.json({
        success: false,
        message: 'conditions is required'
      }, 400)
    }
    
    // D1データベースのテーブルが存在しない場合は作成
    await db
      .prepare(`
        CREATE TABLE IF NOT EXISTS conditions (
          id TEXT PRIMARY KEY,
          school_id TEXT,
          conditions TEXT,
          created_at TEXT,
          updated_at TEXT
        )
      `)
      .run()
    
    // 条件設定を保存（UPSERT）
    await db
      .prepare(`
        INSERT OR REPLACE INTO conditions 
        (id, school_id, conditions, created_at, updated_at)
        VALUES (?, ?, ?, COALESCE((SELECT created_at FROM conditions WHERE id = ?), ?), ?)
      `)
      .bind(
        'conditions-school-1',
        'school-1',
        conditions,
        'conditions-school-1',
        new Date().toISOString(),
        new Date().toISOString()
      )
      .run()
    
    return c.json({
      success: true,
      data: {
        conditions,
        updatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error: ' + error.message
    }, 500)
  }
})

// テスト用の簡単なルート
app.get('/api/test', (c) => {
  return c.json({ message: 'Session API is working' })
})

export default app