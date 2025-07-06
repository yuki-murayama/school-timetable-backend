import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Env } from './lib/db'
import { renderer } from './renderer'
import classesRouter from './routes/classes'
import classroomsRouter from './routes/classrooms'
import schoolsRouter from './routes/schools'
import subjectsRouter from './routes/subjects'
import teachersRouter from './routes/teachers'
import teacherSubjectsRouter from './routes/teacher-subjects'
import timetablesRouter from './routes/timetables'
import constraintsRouter from './routes/constraints'
import frontendApiRouter from './routes/frontend-api'
import databaseManagementRouter from './routes/database-management'
import performanceRouter from './routes/performance'
import authRouter from './routes/auth'
import test from './routes/test'
import { createDocsApp } from './routes/docs'
import { errorHandler } from './lib/error-handler'
import { performanceMonitor } from './lib/performance-monitor'
import { startCacheCleanup } from './lib/cache-system'

const app = new Hono<{ Bindings: Env }>()

// ミドルウェア
app.use('*', performanceMonitor())
app.use('*', errorHandler())
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'https://school-timetable-frontend.vercel.app'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
)
app.use('*', logger())

// キャッシュクリーンアップの開始
startCacheCleanup()

// 静的ファイル配信（フロントエンド用）
app.use('/static/*', serveStatic({ root: './public', manifest: {} }))
app.use('/_next/*', serveStatic({ root: './public', manifest: {} }))

// APIルート
app.route('/api/test', test)
app.route('/api/auth', authRouter)
app.route('/api/schools', schoolsRouter)
app.route('/api/classes', classesRouter)
app.route('/api/classrooms', classroomsRouter)
app.route('/api/subjects', subjectsRouter)
app.route('/api/teachers', teachersRouter)
app.route('/api/assignments', teacherSubjectsRouter)
app.route('/api/timetables', timetablesRouter)
app.route('/api/constraints', constraintsRouter)
app.route('/api/frontend', frontendApiRouter)
app.route('/api/database', databaseManagementRouter)
app.route('/api/performance', performanceRouter)

// APIドキュメント
const docsApp = createDocsApp()
app.route('/docs', docsApp)

// フロントエンド用のルート（必要に応じて）
app.use(renderer)

app.get('/', c => {
  return c.render(
    <div>
      <h1>School Timetable API</h1>
      <p>時間割作成システムのバックエンドAPI</p>
      <h2>利用可能なエンドポイント</h2>
      <h3>テスト用</h3>
      <ul>
        <li>GET /api/test/health - ヘルスチェック</li>
        <li>GET /api/test/mock-schools - モック学校一覧</li>
        <li>POST /api/test/mock-schools - モック学校作成</li>
      </ul>
      <h3>認証システム</h3>
      <ul>
        <li>GET /api/auth/status - Auth0認証設定状態確認</li>
        <li>GET /api/auth/health - 認証ヘルスチェック</li>
        <li>GET /api/auth/config - Auth0設定情報取得（公開）</li>
        <li>GET /api/auth/user/me - 現在のユーザー情報取得</li>
        <li>GET /api/auth/user/permissions - ユーザー権限一覧取得</li>
        <li>POST /api/auth/verify - JWTトークン検証</li>
        <li>POST /api/auth/mock/token - 開発環境用モックトークン生成</li>
        <li>POST /api/auth/mock/user - カスタムモックユーザー生成</li>
      </ul>
      <h3>学校管理</h3>
      <ul>
        <li>GET /api/schools - 学校一覧取得</li>
        <li>POST /api/schools - 学校作成</li>
        <li>GET /api/schools/:id - 学校詳細取得</li>
        <li>PUT /api/schools/:id - 学校更新</li>
        <li>DELETE /api/schools/:id - 学校削除</li>
      </ul>
      <h3>クラス管理</h3>
      <ul>
        <li>GET /api/classes - クラス一覧取得</li>
        <li>POST /api/classes - クラス作成</li>
        <li>GET /api/classes/:id - クラス詳細取得</li>
        <li>PUT /api/classes/:id - クラス更新</li>
        <li>DELETE /api/classes/:id - クラス削除</li>
      </ul>
      <h3>教室管理</h3>
      <ul>
        <li>GET /api/classrooms - 教室一覧取得</li>
        <li>POST /api/classrooms - 教室作成</li>
        <li>GET /api/classrooms/:id - 教室詳細取得</li>
        <li>PUT /api/classrooms/:id - 教室更新</li>
        <li>DELETE /api/classrooms/:id - 教室削除</li>
      </ul>
      <h3>教科管理</h3>
      <ul>
        <li>GET /api/subjects - 教科一覧取得</li>
        <li>POST /api/subjects - 教科作成</li>
        <li>GET /api/subjects/:id - 教科詳細取得</li>
        <li>PUT /api/subjects/:id - 教科更新</li>
        <li>DELETE /api/subjects/:id - 教科削除</li>
      </ul>
      <h3>教師管理</h3>
      <ul>
        <li>GET /api/teachers - 教師一覧取得</li>
        <li>POST /api/teachers - 教師作成</li>
        <li>GET /api/teachers/:id - 教師詳細取得</li>
        <li>PUT /api/teachers/:id - 教師更新</li>
        <li>DELETE /api/teachers/:id - 教師削除</li>
      </ul>
      <h3>教師-教科関係管理</h3>
      <ul>
        <li>GET /api/assignments/teachers/:id/subjects - 教師の担当教科取得</li>
        <li>POST /api/assignments/teachers/:id/subjects - 教科割り当て</li>
        <li>DELETE /api/assignments/teachers/:teacherId/subjects/:subjectId - 割り当て削除</li>
        <li>GET /api/assignments/schools/:id/assignments - 学校内全割り当て取得</li>
      </ul>
      <h3>時間割管理</h3>
      <ul>
        <li>GET /api/timetables - 時間割一覧取得</li>
        <li>POST /api/timetables - 時間割作成</li>
        <li>GET /api/timetables/:id - 時間割詳細取得</li>
        <li>PUT /api/timetables/:id - 時間割更新</li>
        <li>DELETE /api/timetables/:id - 時間割削除</li>
        <li>POST /api/timetables/:id/slots - 時間割スロット一括設定</li>
        <li>GET /api/timetables/:id/slots/:classId - クラス時間割取得</li>
        <li>GET /api/timetables/:id/teachers/:teacherId - 教師時間割取得</li>
        <li>POST /api/timetables/:id/bulk-generate - バルク時間割生成</li>
      </ul>
      <h3>制約条件管理</h3>
      <ul>
        <li>GET /api/constraints - 利用可能な制約条件一覧</li>
        <li>GET /api/constraints/:id - 制約条件詳細取得</li>
        <li>PATCH /api/constraints/:id - 制約条件設定更新</li>
        <li>POST /api/constraints/validate/:timetableId - 制約検証</li>
        <li>POST /api/constraints/validate/:timetableId/category/:category - カテゴリ別制約検証</li>
      </ul>
      <h3>フロントエンド連携API</h3>
      <ul>
        <li>GET /api/frontend/timetables/:id/grid - 時間割グリッドデータ</li>
        <li>GET /api/frontend/timetables/:id/statistics - 統計情報</li>
        <li>POST /api/frontend/timetables/:id/quick-validate - リアルタイム制約検証</li>
        <li>GET /api/frontend/timetables/:id/integrity - データ整合性チェック</li>
        <li>GET /api/frontend/health - システムヘルスチェック</li>
      </ul>
      <h3>データベース管理API</h3>
      <ul>
        <li>GET /api/database/statistics - データベース統計情報</li>
        <li>GET /api/database/schools/:id/integrity - 学校データ整合性チェック</li>
        <li>POST /api/database/timetables/:id/snapshot - 時間割スナップショット作成</li>
        <li>PUT /api/database/schools/:id/constraints/:type - 制約設定管理</li>
        <li>POST /api/database/cleanup - データベースクリーンアップ</li>
        <li>GET /api/database/performance - パフォーマンス分析</li>
      </ul>
      <h3>パフォーマンス監視API</h3>
      <ul>
        <li>GET /api/performance/statistics - パフォーマンス統計</li>
        <li>GET /api/performance/metrics - 詳細メトリクス</li>
        <li>GET /api/performance/cache/statistics - キャッシュ統計</li>
        <li>POST /api/performance/benchmark - エンドポイントベンチマーク</li>
        <li>GET /api/performance/recommendations - 最適化推奨事項</li>
        <li>GET /api/performance/system - システムリソース監視</li>
      </ul>
      <h3>📖 APIドキュメント</h3>
      <ul>
        <li><a href="/docs/ui">Swagger UI - インタラクティブAPIドキュメント</a></li>
        <li><a href="/docs/doc">OpenAPI仕様書 - JSON形式</a></li>
        <li><a href="/docs">ドキュメントホーム</a></li>
      </ul>
    </div>
  )
})

export default app
