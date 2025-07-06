/**
 * ユーティリティ関数の単体テスト
 * D1に依存しない純粋な関数のテスト
 */

import { describe, it, expect } from 'vitest'
import {
  createErrorResponse,
  createSuccessResponse,
  sanitizeSchoolName,
  normalizeGrade,
  normalizeClassName,
  normalizeTeacherName,
  isValidId,
  createTimestamp,
} from './utils'

describe('Utility Functions', () => {
  describe('createErrorResponse', () => {
    it('エラーレスポンスを正しく生成', () => {
      const result = createErrorResponse('TEST_ERROR', 'テストエラーです')
      
      expect(result).toEqual({
        error: 'TEST_ERROR',
        message: 'テストエラーです',
        status: 500,
      })
    })

    it('カスタムステータスコードでエラーレスポンス生成', () => {
      const result = createErrorResponse('NOT_FOUND', 'データが見つかりません', 404)
      
      expect(result.status).toBe(404)
    })
  })

  describe('createSuccessResponse', () => {
    it('成功レスポンスを正しく生成', () => {
      const data = { id: '123', name: 'テスト' }
      const result = createSuccessResponse(data)
      
      expect(result).toEqual({
        success: true,
        data,
        status: 200,
      })
    })

    it('カスタムステータスコードで成功レスポンス生成', () => {
      const data = { id: '123' }
      const result = createSuccessResponse(data, 201)
      
      expect(result.status).toBe(201)
    })
  })

  describe('sanitizeSchoolName', () => {
    it('学校名の前後の空白を削除', () => {
      expect(sanitizeSchoolName('  テスト中学校  ')).toBe('テスト中学校')
    })

    it('学校名の連続する空白を1つにまとめる', () => {
      expect(sanitizeSchoolName('テスト   中学校')).toBe('テスト 中学校')
    })

    it('既に正規化された学校名はそのまま', () => {
      expect(sanitizeSchoolName('テスト中学校')).toBe('テスト中学校')
    })
  })

  describe('normalizeGrade', () => {
    it('有効な学年（1-6）はそのまま返す', () => {
      for (let grade = 1; grade <= 6; grade++) {
        expect(normalizeGrade(grade)).toBe(grade)
      }
    })

    it('小数点のある学年は切り捨て', () => {
      expect(normalizeGrade(1.8)).toBe(1)
      expect(normalizeGrade(3.9)).toBe(3)
    })

    it('範囲外の学年でエラー', () => {
      expect(() => normalizeGrade(0)).toThrow('学年は1-6の範囲で指定してください')
      expect(() => normalizeGrade(7)).toThrow('学年は1-6の範囲で指定してください')
      expect(() => normalizeGrade(-1)).toThrow('学年は1-6の範囲で指定してください')
    })
  })

  describe('normalizeClassName', () => {
    it('学年が含まれていないクラス名に学年を追加', () => {
      expect(normalizeClassName('A組', 1)).toBe('1年A組')
      expect(normalizeClassName('B組', 3)).toBe('3年B組')
    })

    it('既に学年が含まれているクラス名はそのまま', () => {
      expect(normalizeClassName('2年A組', 2)).toBe('2年A組')
      expect(normalizeClassName('1年特進クラス', 1)).toBe('1年特進クラス')
    })

    it('前後の空白を削除', () => {
      expect(normalizeClassName('  A組  ', 1)).toBe('1年A組')
    })
  })

  describe('normalizeTeacherName', () => {
    it('教師名の前後の空白を削除', () => {
      expect(normalizeTeacherName('  田中先生  ')).toBe('田中先生')
    })

    it('教師名の連続する空白を1つにまとめる', () => {
      expect(normalizeTeacherName('田中   太郎')).toBe('田中 太郎')
    })

    it('既に正規化された教師名はそのまま', () => {
      expect(normalizeTeacherName('田中先生')).toBe('田中先生')
    })
  })

  describe('isValidId', () => {
    it('有効なCUID2形式のIDを認識', () => {
      expect(isValidId('cm5q9a2b8000qwd8c6y4m0k7d')).toBe(true)
      expect(isValidId('abcdefghijklmnopqrstuvwxy')).toBe(true)
    })

    it('無効なID形式を拒否', () => {
      expect(isValidId('')).toBe(false)
      expect(isValidId('short')).toBe(false)
      expect(isValidId('ABCDEFGHIJKLMNOPQRSTUVWXY')).toBe(false) // 大文字
      expect(isValidId('abcdefghijklmnopqrstuvwx123')).toBe(false) // 長すぎ
      expect(isValidId('abcdefghijklmnopqrstuvw!')).toBe(false) // 特殊文字
    })
  })

  describe('createTimestamp', () => {
    it('ISO形式のタイムスタンプを生成', () => {
      const timestamp = createTimestamp()
      
      // ISO形式の日付文字列かチェック
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      
      // 有効な日付かチェック
      const date = new Date(timestamp)
      expect(date.toISOString()).toBe(timestamp)
    })

    it('タイムスタンプは現在時刻に近い', () => {
      const timestamp = createTimestamp()
      const now = new Date()
      const timestampDate = new Date(timestamp)
      
      // 1秒以内の差であることを確認
      const diff = Math.abs(now.getTime() - timestampDate.getTime())
      expect(diff).toBeLessThan(1000)
    })
  })
})