/**
 * バリデーションロジックの単体テスト
 * D1に依存しない純粋なロジックのテスト
 */

import { describe, expect, it } from 'vitest'
import {
  CreateClassSchema,
  CreateSchoolSchema,
  CreateTeacherSchema,
  UpdateClassSchema,
  UpdateSchoolSchema,
  UpdateTeacherSchema,
} from './validation'

describe('Validation Schemas', () => {
  describe('CreateSchoolSchema', () => {
    it('有効な学校データをバリデーション通過', () => {
      const validData = {
        name: 'テスト中学校',
      }

      const result = CreateSchoolSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('テスト中学校')
      }
    })

    it('空の学校名でバリデーション失敗', () => {
      const invalidData = {
        name: '',
      }

      const result = CreateSchoolSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('学校名なしでバリデーション失敗', () => {
      const invalidData = {}

      const result = CreateSchoolSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('CreateClassSchema', () => {
    it('有効なクラスデータをバリデーション通過', () => {
      const validData = {
        name: '1年A組',
        grade: 1,
        schoolId: 'school-123',
      }

      const result = CreateClassSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('1年A組')
        expect(result.data.grade).toBe(1)
        expect(result.data.schoolId).toBe('school-123')
      }
    })

    it('学年が範囲外でバリデーション失敗', () => {
      const invalidData = {
        name: '0年A組',
        grade: 0,
        schoolId: 'school-123',
      }

      const result = CreateClassSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('学年が7以上でバリデーション失敗', () => {
      const invalidData = {
        name: '7年A組',
        grade: 7,
        schoolId: 'school-123',
      }

      const result = CreateClassSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('schoolIdなしでバリデーション失敗', () => {
      const invalidData = {
        name: '1年A組',
        grade: 1,
      }

      const result = CreateClassSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('CreateTeacherSchema', () => {
    it('有効な教師データをバリデーション通過', () => {
      const validData = {
        name: '田中先生',
        schoolId: 'school-123',
      }

      const result = CreateTeacherSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('田中先生')
        expect(result.data.schoolId).toBe('school-123')
      }
    })

    it('教師名なしでバリデーション失敗', () => {
      const invalidData = {
        schoolId: 'school-123',
      }

      const result = CreateTeacherSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('UpdateSchemas', () => {
    it('UpdateSchoolSchema - オプショナルフィールドの部分更新', () => {
      const partialData = {
        name: '更新後の学校名',
      }

      const result = UpdateSchoolSchema.safeParse(partialData)
      expect(result.success).toBe(true)
    })

    it('UpdateSchoolSchema - 空オブジェクトでも通過', () => {
      const emptyData = {}

      const result = UpdateSchoolSchema.safeParse(emptyData)
      expect(result.success).toBe(true)
    })

    it('UpdateClassSchema - 部分更新', () => {
      const partialData = {
        grade: 3,
      }

      const result = UpdateClassSchema.safeParse(partialData)
      expect(result.success).toBe(true)
    })
  })
})
