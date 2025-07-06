/**
 * テスト用の簡単なAPI
 * Prismaを使わずに基本的な動作を確認
 */
import { Hono } from 'hono'

const test = new Hono()

// ヘルスチェック
test.get('/health', c => {
  return c.json({
    success: true,
    message: 'API is working!',
    timestamp: new Date().toISOString(),
  })
})

// モックデータ
const mockSchools = [
  { id: '1', name: 'テスト中学校', createdAt: new Date().toISOString() },
  { id: '2', name: 'サンプル高等学校', createdAt: new Date().toISOString() },
]

// モック学校一覧
test.get('/mock-schools', c => {
  return c.json({
    success: true,
    data: mockSchools,
  })
})

// モック学校作成
test.post('/mock-schools', async c => {
  try {
    const body = await c.req.json()
    const newSchool = {
      id: Date.now().toString(),
      name: body.name,
      createdAt: new Date().toISOString(),
    }
    mockSchools.push(newSchool)

    return c.json(
      {
        success: true,
        data: newSchool,
      },
      201
    )
  } catch (_error) {
    return c.json(
      {
        error: 'INVALID_JSON',
        message: 'Invalid JSON body',
      },
      400
    )
  }
})

export default test
