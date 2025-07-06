/**
 * バルク時間割生成用プロンプト作成ロジック
 * 複数クラス、複雑制約を考慮した大規模時間割生成
 */

import { and, eq, inArray } from 'drizzle-orm'
import type { DrizzleDb } from '../db'
import {
  classes,
  classrooms,
  schools,
  subjects,
  teacherSubjects,
  teachers,
  timetables,
} from '../db/schema'
import type { BulkGenerateTimetableInput } from './validation'

interface BulkTimetableData {
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
 * バルク時間割生成に必要なデータを取得
 */
export async function getBulkTimetableGenerationData(
  db: DrizzleDb,
  timetableId: string,
  classIds: string[]
): Promise<BulkTimetableData | null> {
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

    // 指定されたクラス情報を取得
    const classesData = await db
      .select({
        id: classes.id,
        name: classes.name,
        grade: classes.grade,
      })
      .from(classes)
      .where(and(eq(classes.schoolId, schoolId), inArray(classes.id, classIds)))

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
    const teachersMap = new Map<
      string,
      { id: string; name: string; subjects: Array<{ id: string; name: string }> }
    >()

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
    console.error('バルク時間割生成データ取得エラー:', error)
    return null
  }
}

/**
 * Gemini API用のバルク時間割生成プロンプトを生成
 */
export function generateBulkTimetablePrompt(
  data: BulkTimetableData,
  input: BulkGenerateTimetableInput
): string {
  const { timetable, classes, teachers, subjects, classrooms } = data
  const { globalConstraints, teacherConstraints, classroomConstraints, requirements } = input

  const saturdayHours = timetable.saturdayHours
  const periods = [1, 2, 3, 4, 5, 6]

  // 制約情報の整理
  const constraints = buildConstraintInformation(input, teachers, subjects, classrooms)

  const prompt = `あなたは学校の複数クラス時間割生成の専門家です。以下の複雑な制約条件を満たす、全クラスの統合時間割を生成してください。

# 基本情報
学校名: ${timetable.school.name}
時間割名: ${timetable.name}
土曜日授業時間数: ${saturdayHours}時間
対象クラス数: ${classes.length}クラス

# 時間構造
- 平日: 月曜日～金曜日 (1～${periods.length}時限)
- 土曜日: 1～${saturdayHours}時限 (${saturdayHours > 0 ? '授業あり' : '授業なし'})

# 対象クラス情報
${classes.map(c => `・${c.name} (${c.grade}年生) ID: ${c.id}`).join('\n')}

# 教師情報 (${teachers.length}名)
${teachers.map(t => `・${t.name} (担当: ${t.subjects.map(s => s.name).join('、')}) ID: ${t.id}`).join('\n')}

# 教科情報 (${subjects.length}教科)
${subjects.map(s => `・${s.name} ID: ${s.id}`).join('\n')}

# 教室情報 (${classrooms.length}室)
${classrooms.map(c => `・${c.name} (${c.type}${c.capacity ? `、定員${c.capacity}人` : ''}) ID: ${c.id}`).join('\n')}

# 重要制約条件
${constraints}

# 生成要求
${requirements || '標準的な時間割配置'}

# **最重要**: 全クラス統合制約
1. **教師重複禁止**: 同一教師が同一時間に複数クラスを担当することは絶対に禁止
2. **教室重複禁止**: 同一教室が同一時間に複数クラスで使用されることは絶対に禁止  
3. **教科対応**: 各教師は担当教科のみ指導可能
4. **バランス配置**: 全クラスで適切な教科バランスを確保

# 出力形式
以下の正確なJSON形式で、**全クラス分の統合時間割**を出力してください：

\`\`\`json
{
  "success": true,
  "timetable": {
    "timetableId": "${timetable.id}",
    "schedules": [
      {
        "classId": "(必須)対象クラスID",
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

重要事項:
- dayOfWeek: 1=月、2=火、3=水、4=木、5=金、6=土
- period: 1-${periods.length} (土曜は1-${saturdayHours})
- **絶対条件**: 教師・教室の時間重複は完全に排除
- 全${classes.length}クラス分のスケジュールを含める
- JSONのみ出力、説明不要`

  return prompt.trim()
}

/**
 * 制約情報を文字列として整理
 */
function buildConstraintInformation(
  input: BulkGenerateTimetableInput,
  teachers: Array<{ id: string; name: string }>,
  subjects: Array<{ id: string; name: string }>,
  classrooms: Array<{ id: string; name: string }>
): string {
  const constraints: string[] = []

  // グローバル制約
  if (input.globalConstraints) {
    const gc = input.globalConstraints

    if (gc.subjectDistribution === 'balanced') {
      constraints.push('・教科配置: バランス重視（各教科を均等に配置）')
    } else if (gc.subjectDistribution === 'concentrated') {
      constraints.push('・教科配置: 集中配置（同一教科をまとめて配置）')
    }

    if (gc.timeSlotPreferences) {
      const tp = gc.timeSlotPreferences
      if (tp.morningSubjects?.length) {
        const subjectNames = tp.morningSubjects
          .map(id => subjects.find(s => s.id === id)?.name || id)
          .join('、')
        constraints.push(`・午前推奨教科: ${subjectNames}`)
      }
      if (tp.afternoonSubjects?.length) {
        const subjectNames = tp.afternoonSubjects
          .map(id => subjects.find(s => s.id === id)?.name || id)
          .join('、')
        constraints.push(`・午後推奨教科: ${subjectNames}`)
      }
    }
  }

  // 教師制約
  if (input.teacherConstraints?.length) {
    constraints.push('・教師個別制約:')
    for (const tc of input.teacherConstraints) {
      const teacherName = teachers.find(t => t.id === tc.teacherId)?.name || tc.teacherId
      if (tc.unavailableSlots?.length) {
        const slots = tc.unavailableSlots
          .map(slot => `${slot.dayOfWeek}曜${slot.period}時限`)
          .join('、')
        constraints.push(`  - ${teacherName}: 出勤不可 ${slots}`)
      }
      if (tc.maxDailyHours) {
        constraints.push(`  - ${teacherName}: 1日最大${tc.maxDailyHours}時間`)
      }
    }
  }

  // 教室制約
  if (input.classroomConstraints?.length) {
    constraints.push('・教室個別制約:')
    for (const cc of input.classroomConstraints) {
      const roomName = classrooms.find(r => r.id === cc.classroomId)?.name || cc.classroomId
      if (cc.unavailableSlots?.length) {
        const slots = cc.unavailableSlots
          .map(slot => `${slot.dayOfWeek}曜${slot.period}時限`)
          .join('、')
        constraints.push(`  - ${roomName}: 使用不可 ${slots}`)
      }
      if (cc.dedicatedSubjects?.length) {
        const subjectNames = cc.dedicatedSubjects
          .map(id => subjects.find(s => s.id === id)?.name || id)
          .join('、')
        constraints.push(`  - ${roomName}: 専用教科 ${subjectNames}`)
      }
    }
  }

  return constraints.length > 0 ? constraints.join('\n') : '・標準制約のみ適用'
}
