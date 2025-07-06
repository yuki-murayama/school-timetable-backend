import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

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

// 学校設定取得（固定値）
app.get('/api/frontend/school/settings', c => {
  return c.json({
    success: true,
    data: {
      grade1Classes: 4,
      grade2Classes: 4,
      grade3Classes: 3,
      dailyPeriods: 6,
      saturdayPeriods: 4,
    },
  })
})

// 学校設定更新（モック）
app.put('/api/frontend/school/settings', async c => {
  const body = await c.req.json()

  return c.json({
    success: true,
    data: {
      message: '設定が正常に更新されました（テスト版）',
      settings: body,
    },
  })
})

export default app
