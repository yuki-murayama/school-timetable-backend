/**
 * Drizzle ORM クライアントの初期化設定
 * Cloudflare D1 用の設定
 */
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export interface Env {
  DB: D1Database
  GEMINI_API_KEY?: string
}

export function createDb(env: Env) {
  return drizzle(env.DB, { schema })
}

export type DrizzleDb = ReturnType<typeof createDb>

// スキーマのエクスポート
export * from './schema'
