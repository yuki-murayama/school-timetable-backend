/**
 * Drizzle ORM クライアントの初期化設定
 * Cloudflare D1 用の設定
 */

import { createDb, type Env } from '../db'

export type { Env }

export function createDatabase(env: Env) {
  return createDb(env)
}
