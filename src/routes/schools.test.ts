/**
 * 学校API テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import schoolsRouter from './schools'

// テスト用のアプリケーションをセットアップ
const testApp = new Hono()
testApp.route('/api/schools', schoolsRouter)

// モックデータベース
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn(),
        all: vi.fn(),
      })),
      get: vi.fn(),
      all: vi.fn(),
      orderBy: vi.fn(() => ({
        all: vi.fn(),
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => ({
        get: vi.fn(),
      })),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => ({
          get: vi.fn(),
        })),
      })),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(),
  })),
}

// createDatabase関数をモック
vi.mock('../lib/db', () => ({
  createDatabase: vi.fn(() => mockDb),
}))

describe('Schools API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/schools', () => {
    it('学校一覧を取得できる', async () => {
      // モックデータ
      const mockSchools = [
        {
          id: 'school1',
          name: 'テスト中学校',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]

      mockDb.select().from().orderBy().all.mockResolvedValueOnce(mockSchools)

      const res = await testApp.request('/api/schools', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockSchools)
    })

    it('空の学校一覧を取得できる', async () => {
      mockDb.select().from().orderBy().all.mockResolvedValueOnce([])

      const res = await testApp.request('/api/schools', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data).toEqual([])
    })
  })

  describe('POST /api/schools', () => {
    it('学校を作成できる', async () => {
      const newSchool = {
        id: 'new-school-id',
        name: '新しい中学校',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }

      // 重複チェック（なし）
      mockDb.select().from().where().get.mockResolvedValueOnce(null)
      // 作成
      mockDb.insert().values().returning().get.mockResolvedValueOnce(newSchool)

      const res = await testApp.request('/api/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: '新しい中学校',
        }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('新しい中学校')
    })

    it('重複した学校名でエラーになる', async () => {
      // 重複チェック（あり）
      mockDb.select().from().where().get.mockResolvedValueOnce({
        id: 'existing-school',
        name: '既存の中学校',
      })

      const res = await testApp.request('/api/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: '既存の中学校',
        }),
      })

      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.error).toBe('SCHOOL_ALREADY_EXISTS')
    })

    it('空の学校名でバリデーションエラーになる', async () => {
      const res = await testApp.request('/api/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: '',
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/schools/:id', () => {
    it('指定した学校の詳細を取得できる', async () => {
      const mockSchool = {
        id: 'school1',
        name: 'テスト中学校',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }

      mockDb.select().from().where().get.mockResolvedValueOnce(mockSchool)

      const res = await testApp.request('/api/schools/school1', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockSchool)
    })

    it('存在しない学校IDで404エラーになる', async () => {
      mockDb.select().from().where().get.mockResolvedValueOnce(null)

      const res = await testApp.request('/api/schools/nonexistent', {
        method: 'GET',
      })

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('SCHOOL_NOT_FOUND')
    })
  })

  describe('PUT /api/schools/:id', () => {
    it('学校情報を更新できる', async () => {
      const existingSchool = {
        id: 'school1',
        name: '古い名前',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }

      const updatedSchool = {
        ...existingSchool,
        name: '新しい名前',
        updatedAt: '2024-01-02T00:00:00.000Z',
      }

      // 存在チェック
      mockDb.select().from().where().get.mockResolvedValueOnce(existingSchool)
      // 重複チェック（なし）
      mockDb.select().from().where().get.mockResolvedValueOnce(null)
      // 更新
      mockDb.update().set().where().returning().get.mockResolvedValueOnce(updatedSchool)

      const res = await testApp.request('/api/schools/school1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: '新しい名前',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('新しい名前')
    })
  })

  describe('DELETE /api/schools/:id', () => {
    it('学校を削除できる', async () => {
      const existingSchool = {
        id: 'school1',
        name: 'テスト中学校',
      }

      // 存在チェック
      mockDb.select().from().where().get.mockResolvedValueOnce(existingSchool)
      // 削除
      mockDb.delete().where.mockResolvedValueOnce({})

      const res = await testApp.request('/api/schools/school1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })

    it('存在しない学校を削除しようとして404エラーになる', async () => {
      mockDb.select().from().where().get.mockResolvedValueOnce(null)

      const res = await testApp.request('/api/schools/nonexistent', {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('SCHOOL_NOT_FOUND')
    })
  })
})