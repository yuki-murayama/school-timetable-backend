/**
 * 時間割生成用プロンプト作成ロジック
 * データベースから情報を取得して、Claude API用のプロンプトを構築
 */

import { eq, and } from 'drizzle-orm'
import type { DrizzleDb } from '../db'
import { timetables, schools, classes, subjects, teachers, classrooms, teacherSubjects } from '../db/schema'

interface TimetableData {
  timetable: {
    id: string
    name: string
    saturdayHours: number
    school: {
      id: string
      name: string
    }
  }
  classes: Array<{
    id: string
    name: string
    grade: number
  }>
  teachers: Array<{
    id: string
    name: string
    subjects: Array<{
      id: string
      name: string
    }>
  }>
  subjects: Array<{
    id: string
    name: string
  }>
  classrooms: Array<{
    id: string
    name: string
    type: string
    capacity?: number
  }>
}

/**
 * 時間割生成に必要なデータを取得
 */
export async function getTimetableGenerationData(
  db: DrizzleDb,
  timetableId: string
): Promise<TimetableData | null> {
  try {
    // 時間割と学校情報を取得
    const timetableData = await db
      .select({
        id: timetables.id,
        name: timetables.name,
        saturdayHours: timetables.saturdayHours,
        school: {
          id: schools.id,
          name: schools.name,
        },
      })
      .from(timetables)
      .leftJoin(schools, eq(timetables.schoolId, schools.id))
      .where(eq(timetables.id, timetableId))
      .get()

    if (!timetableData) {
      return null
    }

    const schoolId = timetableData.school.id

    // クラス情報を取得
    const classesData = await db
      .select({
        id: classes.id,
        name: classes.name,
        grade: classes.grade,
      })
      .from(classes)
      .where(eq(classes.schoolId, schoolId))

    // 教師と担当教科情報を取得
    const teachersData = await db
      .select({
        id: teachers.id,
        name: teachers.name,
        subjectId: subjects.id,
        subjectName: subjects.name,
      })
      .from(teachers)
      .leftJoin(teacherSubjects, eq(teachers.id, teacherSubjects.teacherId))
      .leftJoin(subjects, eq(teacherSubjects.subjectId, subjects.id))
      .where(eq(teachers.schoolId, schoolId))

    // 教師ごとに担当教科をグループ化
    const teachersMap = new Map<string, { id: string; name: string; subjects: Array<{ id: string; name: string }> }>()
    
    for (const teacher of teachersData) {
      if (!teachersMap.has(teacher.id)) {
        teachersMap.set(teacher.id, {
          id: teacher.id,
          name: teacher.name,
          subjects: [],
        })
      }
      
      if (teacher.subjectId && teacher.subjectName) {
        const teacherData = teachersMap.get(teacher.id)!
        teacherData.subjects.push({
          id: teacher.subjectId,
          name: teacher.subjectName,
        })
      }
    }

    // 教科情報を取得
    const subjectsData = await db
      .select({
        id: subjects.id,
        name: subjects.name,
      })
      .from(subjects)
      .where(eq(subjects.schoolId, schoolId))

    // 教室情報を取得
    const classroomsData = await db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        type: classrooms.type,
        capacity: classrooms.capacity,
      })
      .from(classrooms)
      .where(eq(classrooms.schoolId, schoolId))

    return {
      timetable: timetableData,
      classes: classesData,
      teachers: Array.from(teachersMap.values()),
      subjects: subjectsData,
      classrooms: classroomsData,
    }
  } catch (error) {
    console.error('時間割生成データ取得エラー:', error)
    return null
  }
}

/**
 * Gemini API用のプロンプトを生成
 */
export function generateTimetablePrompt(
  data: TimetableData,
  requirements?: string
): string {
  const { timetable, classes, teachers, subjects, classrooms } = data
  
  // 基本的な時間割構造（月～金 + 土曜日の時間数）
  const weekdays = ['月', '火', '水', '木', '金']
  const saturdayHours = timetable.saturdayHours
  const periods = [1, 2, 3, 4, 5, 6] // 基本的な時間割（1〜6時限）

  const prompt = `あなたは学校の時間割生成の専門家です。以下の情報をもとに、制約条件を満たす時間割を生成してください。

# 基本情報
学校名: ${timetable.school.name}
時間割名: ${timetable.name}
土曜日授業時間数: ${saturdayHours}時間

# 制約条件

## 時間構造
- 平日: 月曜日〜金曜日 (1〜${periods.length}時限)
- 土曜日: 1〜${saturdayHours}時限 (${saturdayHours > 0 ? '授業あり' : '授業なし'})

## クラス情報
${classes.map(c => `・${c.name} (${c.grade}年生) ID: ${c.id}`).join('\n')}

## 教師情報
${teachers.map(t => `・${t.name} (担当: ${t.subjects.map(s => s.name).join('、')}) ID: ${t.id}`).join('\n')}

## 教科情報
${subjects.map(s => `・${s.name} ID: ${s.id}`).join('\n')}

## 教室情報
${classrooms.map(c => `・${c.name} (${c.type}${c.capacity ? `、定員${c.capacity}人` : ''}) ID: ${c.id}`).join('\n')}

# 生成ルール
1. 教師の時間重複は厳禁
2. 教室の時間重複は厳禁
3. 教師は担当教科のみ指導可能
4. 各クラスに適切な教科バランスを確保
5. IDは必ず提供されたものを使用

# 追加要求
${requirements || '特になし'}

# 出力形式
以下の正確なJSON形式で出力してください：

\`\`\`json
{
  "success": true,
  "timetable": {
    "timetableId": "${timetable.id}",
    "schedules": [
      {
        "classId": "(必須)クラスID",
        "subjectId": "(必須)教科ID",
        "teacherId": "(必須)教師ID",
        "classroomId": "(必須)教室ID",
        "dayOfWeek": 1,
        "period": 1
      }
    ]
  },
  "summary": {
    "totalSlots": 0,
    "classCount": ${classes.length},
    "conflicts": []
  }
}
\`\`\`

重要:
- dayOfWeek: 1=月、2=火、3=水、4=木、5=金、6=土
- period: 1-6 (土曜は1-${saturdayHours})
- 競合エラーは避けること
- JSONのみ出力、説明不要`

  return prompt.trim()
}