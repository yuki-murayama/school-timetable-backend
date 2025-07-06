/**
 * 学校時間割作成システムの完全データベーススキーマ
 * Cloudflare D1 (SQLite) 用の設定
 * 実運用に必要な全機能を含む
 */

import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// ユーザー管理テーブル
export const users = sqliteTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    email: text('email').notNull().unique(),
    hashedPassword: text('hashed_password').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull().default('teacher'), // 'admin', 'school_admin', 'teacher', 'viewer'
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    lastLoginAt: text('last_login_at'),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    emailIndex: index('user_email_idx').on(table.email),
    roleIndex: index('user_role_idx').on(table.role),
  })
)

// ユーザーと学校の関係（複数学校のアクセス権限）
export const userSchools = sqliteTable(
  'user_schools',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    schoolId: text('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('teacher'), // 'admin', 'editor', 'viewer'
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    uniqueUserSchool: uniqueIndex('unique_user_school').on(table.userId, table.schoolId),
  })
)

// 拡張学校情報
export const schools = sqliteTable('schools', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  type: text('type').notNull().default('middle_school'), // 'elementary', 'middle_school', 'high_school', 'combined'
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  principalName: text('principal_name'),
  timezone: text('timezone').notNull().default('Asia/Tokyo'),
  settings: text('settings', { mode: 'json' }).$type<{
    periodsPerDay: number
    daysPerWeek: number
    termSystem: 'semester' | 'quarter' | 'trimester'
    holidayCalendar: string[]
    constraints: Record<string, any>
  }>(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

// 拡張クラス情報
export const classes = sqliteTable(
  'classes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull(),
    grade: integer('grade').notNull(),
    section: text('section'), // 組（A, B, C...）
    studentCount: integer('student_count').default(0),
    homeRoomTeacherId: text('homeroom_teacher_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    schoolId: text('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    uniqueClassInSchool: uniqueIndex('unique_class_in_school').on(table.schoolId, table.name),
    gradeIndex: index('class_grade_idx').on(table.grade),
  })
)

// 拡張教師情報
export const teachers = sqliteTable(
  'teachers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull(),
    employeeNumber: text('employee_number'),
    email: text('email'),
    phone: text('phone'),
    specialization: text('specialization'), // 専門分野
    employmentType: text('employment_type').notNull().default('full_time'), // 'full_time', 'part_time', 'substitute'
    maxHoursPerWeek: integer('max_hours_per_week').default(0),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    schoolId: text('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    employeeNumberIndex: index('teacher_employee_number_idx').on(table.employeeNumber),
    userIndex: index('teacher_user_idx').on(table.userId),
  })
)

// 拡張教科情報
export const subjects = sqliteTable(
  'subjects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull(),
    shortName: text('short_name'), // 略称
    subjectCode: text('subject_code'), // 教科コード
    category: text('category').notNull().default('core'), // 'core', 'elective', 'extracurricular'
    weeklyHours: integer('weekly_hours').default(0), // 週時間数
    requiresSpecialRoom: integer('requires_special_room', { mode: 'boolean' }).default(false),
    color: text('color').default('#3498db'), // UIでの表示色
    settings: text('settings', { mode: 'json' }).$type<{
      consecutiveHoursAllowed: number
      preferredTimeSlots: string[]
      avoidTimeSlots: string[]
      requiresEquipment: boolean
    }>(),
    schoolId: text('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    codeIndex: index('subject_code_idx').on(table.subjectCode),
    categoryIndex: index('subject_category_idx').on(table.category),
  })
)

// 拡張教室情報
export const classrooms = sqliteTable(
  'classrooms',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull(),
    roomNumber: text('room_number'),
    building: text('building'),
    floor: integer('floor'),
    type: text('type').notNull(), // 'regular', 'special', 'laboratory', 'gym', 'library'
    capacity: integer('capacity'),
    equipment: text('equipment', { mode: 'json' }).$type<string[]>(), // 設備リスト
    notes: text('notes'),
    schoolId: text('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    roomNumberIndex: index('classroom_room_number_idx').on(table.roomNumber),
    typeIndex: index('classroom_type_idx').on(table.type),
  })
)

// 教師と教科の関係（拡張）
export const teacherSubjects = sqliteTable(
  'teacher_subjects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    qualificationLevel: text('qualification_level').default('qualified'), // 'expert', 'qualified', 'trainee'
    priority: integer('priority').default(1), // 担当優先度
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    uniqueTeacherSubject: uniqueIndex('unique_teacher_subject').on(
      table.teacherId,
      table.subjectId
    ),
    priorityIndex: index('teacher_subject_priority_idx').on(table.priority),
  })
)

// 教室と教科の関係（専用教室）
export const classroomSubjects = sqliteTable(
  'classroom_subjects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    classroomId: text('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    uniqueClassroomSubject: uniqueIndex('unique_classroom_subject').on(
      table.classroomId,
      table.subjectId
    ),
  })
)

// 拡張時間割情報
export const timetables = sqliteTable(
  'timetables',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull(),
    description: text('description'),
    academicYear: text('academic_year').notNull(), // '2024'
    term: text('term').notNull(), // 'spring', 'summer', 'fall', 'winter'
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    version: integer('version').notNull().default(1),
    status: text('status').notNull().default('draft'), // 'draft', 'active', 'archived'
    schoolId: text('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: text('approved_at'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
    saturdayHours: integer('saturday_hours').notNull().default(0),
    settings: text('settings', { mode: 'json' }).$type<{
      periodsPerDay: number
      lunchBreakPeriod: number
      constraints: Record<string, any>
      holidays: string[]
    }>(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    statusIndex: index('timetable_status_idx').on(table.status),
    academicYearIndex: index('timetable_academic_year_idx').on(table.academicYear),
    activeIndex: index('timetable_active_idx').on(table.isActive),
  })
)

// 時間割履歴管理
export const timetableHistory = sqliteTable(
  'timetable_history',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    timetableId: text('timetable_id')
      .notNull()
      .references(() => timetables.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    changeType: text('change_type').notNull(), // 'created', 'updated', 'approved', 'archived'
    changeDescription: text('change_description'),
    changedBy: text('changed_by').references(() => users.id, { onDelete: 'set null' }),
    snapshotData: text('snapshot_data', { mode: 'json' }).$type<any>(), // スナップショット
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    timetableVersionIndex: index('timetable_history_version_idx').on(
      table.timetableId,
      table.version
    ),
    changeTypeIndex: index('timetable_history_change_type_idx').on(table.changeType),
  })
)

// 拡張授業スケジュール
export const schedules = sqliteTable(
  'schedules',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    timetableId: text('timetable_id')
      .notNull()
      .references(() => timetables.id, { onDelete: 'cascade' }),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    classroomId: text('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(), // 1: 月曜, 2: 火曜, ..., 6: 土曜
    period: integer('period').notNull(),
    weekType: text('week_type').default('all'), // 'all', 'A', 'B' (隔週対応)
    isSubstitute: integer('is_substitute', { mode: 'boolean' }).default(false), // 代替授業フラグ
    originalScheduleId: text('original_schedule_id').references(() => schedules.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    generatedBy: text('generated_by').default('manual'), // 'manual', 'ai', 'bulk'
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    uniqueSchedule: uniqueIndex('unique_schedule').on(
      table.timetableId,
      table.classId,
      table.dayOfWeek,
      table.period,
      table.weekType
    ),
    timetableIndex: index('schedule_timetable_idx').on(table.timetableId),
    classIndex: index('schedule_class_idx').on(table.classId),
    teacherIndex: index('schedule_teacher_idx').on(table.teacherId),
    timeSlotIndex: index('schedule_time_slot_idx').on(table.dayOfWeek, table.period),
  })
)

// 制約条件設定
export const constraintConfigurations = sqliteTable(
  'constraint_configurations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    schoolId: text('school_id')
      .notNull()
      .references(() => schools.id, { onDelete: 'cascade' }),
    constraintType: text('constraint_type').notNull(), // 制約タイプID
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
    priority: integer('priority').notNull().default(5),
    parameters: text('parameters', { mode: 'json' }).$type<Record<string, any>>(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    uniqueSchoolConstraint: uniqueIndex('unique_school_constraint').on(
      table.schoolId,
      table.constraintType
    ),
    priorityIndex: index('constraint_priority_idx').on(table.priority),
  })
)

// 生成ログ
export const generationLogs = sqliteTable(
  'generation_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    timetableId: text('timetable_id')
      .notNull()
      .references(() => timetables.id, { onDelete: 'cascade' }),
    generationType: text('generation_type').notNull(), // 'single', 'bulk', 'manual'
    status: text('status').notNull(), // 'started', 'completed', 'failed'
    targetClasses: text('target_classes', { mode: 'json' }).$type<string[]>(),
    generationTime: integer('generation_time'), // ミリ秒
    errorMessage: text('error_message'),
    constraintViolations: text('constraint_violations', { mode: 'json' }).$type<any[]>(),
    aiModel: text('ai_model').default('gemini-2.0-flash'),
    requestedBy: text('requested_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    timetableIndex: index('generation_log_timetable_idx').on(table.timetableId),
    statusIndex: index('generation_log_status_idx').on(table.status),
    typeIndex: index('generation_log_type_idx').on(table.generationType),
  })
)

// システム設定
export const systemSettings = sqliteTable(
  'system_settings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    key: text('key').notNull().unique(),
    value: text('value', { mode: 'json' }).$type<any>(),
    description: text('description'),
    category: text('category').notNull().default('general'),
    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  table => ({
    categoryIndex: index('system_settings_category_idx').on(table.category),
  })
)

// 型定義のエクスポート
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type UserSchool = typeof userSchools.$inferSelect
export type NewUserSchool = typeof userSchools.$inferInsert
export type School = typeof schools.$inferSelect
export type NewSchool = typeof schools.$inferInsert
export type Class = typeof classes.$inferSelect
export type NewClass = typeof classes.$inferInsert
export type Teacher = typeof teachers.$inferSelect
export type NewTeacher = typeof teachers.$inferInsert
export type Subject = typeof subjects.$inferSelect
export type NewSubject = typeof subjects.$inferInsert
export type Classroom = typeof classrooms.$inferSelect
export type NewClassroom = typeof classrooms.$inferInsert
export type TeacherSubject = typeof teacherSubjects.$inferSelect
export type NewTeacherSubject = typeof teacherSubjects.$inferInsert
export type ClassroomSubject = typeof classroomSubjects.$inferSelect
export type NewClassroomSubject = typeof classroomSubjects.$inferInsert
export type Timetable = typeof timetables.$inferSelect
export type NewTimetable = typeof timetables.$inferInsert
export type TimetableHistory = typeof timetableHistory.$inferSelect
export type NewTimetableHistory = typeof timetableHistory.$inferInsert
export type Schedule = typeof schedules.$inferSelect
export type NewSchedule = typeof schedules.$inferInsert
export type ConstraintConfiguration = typeof constraintConfigurations.$inferSelect
export type NewConstraintConfiguration = typeof constraintConfigurations.$inferInsert
export type GenerationLog = typeof generationLogs.$inferSelect
export type NewGenerationLog = typeof generationLogs.$inferInsert
export type SystemSetting = typeof systemSettings.$inferSelect
export type NewSystemSetting = typeof systemSettings.$inferInsert
