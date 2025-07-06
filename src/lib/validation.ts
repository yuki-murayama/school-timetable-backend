/**
 * Zod バリデーションスキーマ定義
 */
import { z } from 'zod'

// 学校関連のスキーマ
export const CreateSchoolSchema = z.object({
  name: z.string().min(1, '学校名は必須です'),
})

export const UpdateSchoolSchema = z.object({
  name: z.string().min(1, '学校名は必須です').optional(),
})

// クラス関連のスキーマ
export const CreateClassSchema = z.object({
  name: z.string().min(1, 'クラス名は必須です'),
  grade: z.number().int().min(1).max(6),
  schoolId: z.string().min(1, '学校IDは必須です'),
})

export const UpdateClassSchema = z.object({
  name: z.string().min(1, 'クラス名は必須です').optional(),
  grade: z.number().int().min(1).max(6).optional(),
})

// 教師関連のスキーマ
export const CreateTeacherSchema = z.object({
  name: z.string().min(1, '教師名は必須です'),
  schoolId: z.string().min(1, '学校IDは必須です'),
})

export const UpdateTeacherSchema = z.object({
  name: z.string().min(1, '教師名は必須です').optional(),
})

// 教科関連のスキーマ
export const CreateSubjectSchema = z.object({
  name: z.string().min(1, '教科名は必須です'),
  schoolId: z.string().min(1, '学校IDは必須です'),
})

export const UpdateSubjectSchema = z.object({
  name: z.string().min(1, '教科名は必須です').optional(),
})

// 教室関連のスキーマ
export const CreateClassroomSchema = z.object({
  name: z.string().min(1, '教室名は必須です'),
  type: z.string().min(1, '教室タイプは必須です'),
  capacity: z.number().int().min(1).optional(),
  schoolId: z.string().min(1, '学校IDは必須です'),
})

export const UpdateClassroomSchema = z.object({
  name: z.string().min(1, '教室名は必須です').optional(),
  type: z.string().min(1, '教室タイプは必須です').optional(),
  capacity: z.number().int().min(1).optional(),
})

// 時間割関連のスキーマ
export const CreateTimetableSchema = z.object({
  name: z.string().min(1, '時間割名は必須です'),
  schoolId: z.string().min(1, '学校IDは必須です'),
  saturdayHours: z.number().int().min(0).max(8).default(0),
})

export const UpdateTimetableSchema = z.object({
  name: z.string().min(1, '時間割名は必須です').optional(),
  isActive: z.boolean().optional(),
  saturdayHours: z.number().int().min(0).max(8).optional(),
})

// エラーレスポンス用のスキーマ
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
})

// 成功レスポンス用のスキーマ
export const SuccessResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
})

// 時間割生成用のスキーマ
export const GenerateTimetableSchema = z.object({
  timetableId: z.string().min(1, '時間割IDは必須です'),
  requirements: z.string().optional().describe('特別な要求事項や制約'),
  priority: z.enum(['speed', 'quality', 'balanced']).default('balanced').describe('生成の優先度'),
})

// バルク時間割生成用のスキーマ
export const BulkGenerateTimetableSchema = z.object({
  classIds: z.array(z.string()).min(1, '対象クラスIDは必須です').describe('生成対象のクラスID配列'),
  globalConstraints: z.object({
    teacherConflictCheck: z.boolean().default(true).describe('教師の時間重複チェック'),
    classroomConflictCheck: z.boolean().default(true).describe('教室の時間重複チェック'),
    subjectDistribution: z.enum(['balanced', 'concentrated', 'flexible']).default('balanced').describe('教科配置方針'),
    timeSlotPreferences: z.object({
      morningSubjects: z.array(z.string()).optional().describe('午前推奨教科ID'),
      afternoonSubjects: z.array(z.string()).optional().describe('午後推奨教科ID'),
      avoidFirstPeriod: z.array(z.string()).optional().describe('1時限目回避教科ID'),
      avoidLastPeriod: z.array(z.string()).optional().describe('最終時限回避教科ID'),
    }).optional(),
  }).optional(),
  teacherConstraints: z.array(z.object({
    teacherId: z.string(),
    unavailableSlots: z.array(z.object({
      dayOfWeek: z.number().min(1).max(6),
      period: z.number().min(1).max(6),
    })).optional().describe('出勤不可時間'),
    maxDailyHours: z.number().min(1).max(6).optional().describe('1日最大授業時間'),
    preferredSubjects: z.array(z.string()).optional().describe('優先担当教科ID'),
  })).optional(),
  classroomConstraints: z.array(z.object({
    classroomId: z.string(),
    unavailableSlots: z.array(z.object({
      dayOfWeek: z.number().min(1).max(6),
      period: z.number().min(1).max(6),
    })).optional().describe('使用不可時間'),
    dedicatedSubjects: z.array(z.string()).optional().describe('専用教科ID（理科室→理科など）'),
  })).optional(),
  requirements: z.string().optional().describe('追加の特別要求事項'),
  priority: z.enum(['speed', 'quality', 'balanced']).default('balanced').describe('生成の優先度'),
  maxRetries: z.number().min(1).max(10).default(3).describe('生成失敗時の最大リトライ回数'),
})

export type CreateSchoolInput = z.infer<typeof CreateSchoolSchema>
export type UpdateSchoolInput = z.infer<typeof UpdateSchoolSchema>
export type CreateClassInput = z.infer<typeof CreateClassSchema>
export type UpdateClassInput = z.infer<typeof UpdateClassSchema>
export type CreateTeacherInput = z.infer<typeof CreateTeacherSchema>
export type UpdateTeacherInput = z.infer<typeof UpdateTeacherSchema>
export type CreateSubjectInput = z.infer<typeof CreateSubjectSchema>
export type UpdateSubjectInput = z.infer<typeof UpdateSubjectSchema>
export type CreateClassroomInput = z.infer<typeof CreateClassroomSchema>
export type UpdateClassroomInput = z.infer<typeof UpdateClassroomSchema>
export type CreateTimetableInput = z.infer<typeof CreateTimetableSchema>
export type UpdateTimetableInput = z.infer<typeof UpdateTimetableSchema>
export type GenerateTimetableInput = z.infer<typeof GenerateTimetableSchema>
export type BulkGenerateTimetableInput = z.infer<typeof BulkGenerateTimetableSchema>
