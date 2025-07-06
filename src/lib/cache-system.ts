/**
 * インメモリキャッシュシステム
 * データベースクエリ結果とAPI応答の高速化
 */

// キャッシュエントリ型定義
interface CacheEntry<T> {
  data: T
  expiredAt: number
  createdAt: number
  accessCount: number
  lastAccessedAt: number
}

// キャッシュ統計型定義
interface CacheStats {
  hits: number
  misses: number
  size: number
  maxSize: number
  hitRate: number
  memoryUsage: number
  oldestEntry?: number
  newestEntry?: number
}

/**
 * LRU (Least Recently Used) キャッシュクラス
 */
export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private readonly maxSize: number
  private readonly defaultTTL: number
  private hits = 0
  private misses = 0

  constructor(maxSize: number = 1000, defaultTTL: number = 300000) {
    // デフォルト5分
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
  }

  /**
   * キャッシュからデータを取得
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.misses++
      return null
    }

    // TTL チェック
    if (Date.now() > entry.expiredAt) {
      this.cache.delete(key)
      this.misses++
      return null
    }

    // アクセス情報更新
    entry.accessCount++
    entry.lastAccessedAt = Date.now()

    // LRU更新（Map は挿入順を保持するため、削除→再挿入でLRU実現）
    this.cache.delete(key)
    this.cache.set(key, entry)

    this.hits++
    return entry.data
  }

  /**
   * キャッシュにデータを保存
   */
  set(key: string, data: T, ttl?: number): void {
    const now = Date.now()
    const expiredAt = now + (ttl || this.defaultTTL)

    // 既存エントリの更新
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // サイズ制限チェック
    if (this.cache.size >= this.maxSize) {
      // 最も古いエントリを削除
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    const entry: CacheEntry<T> = {
      data,
      expiredAt,
      createdAt: now,
      accessCount: 0,
      lastAccessedAt: now,
    }

    this.cache.set(key, entry)
  }

  /**
   * キャッシュからデータを削除
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * パターンマッチでキャッシュクリア
   */
  clear(pattern?: string): number {
    if (!pattern) {
      const size = this.cache.size
      this.cache.clear()
      return size
    }

    let deletedCount = 0
    const regex = new RegExp(pattern)

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        deletedCount++
      }
    }

    return deletedCount
  }

  /**
   * 期限切れエントリをクリーンアップ
   */
  cleanup(): number {
    const now = Date.now()
    let deletedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiredAt) {
        this.cache.delete(key)
        deletedCount++
      }
    }

    return deletedCount
  }

  /**
   * キャッシュ統計取得
   */
  getStats(): CacheStats {
    const now = Date.now()
    let oldestEntry: number | undefined
    let newestEntry: number | undefined
    let memoryUsage = 0

    for (const entry of this.cache.values()) {
      const entryAge = now - entry.createdAt
      if (oldestEntry === undefined || entryAge > oldestEntry) {
        oldestEntry = entryAge
      }
      if (newestEntry === undefined || entryAge < newestEntry) {
        newestEntry = entryAge
      }

      // 概算メモリ使用量（JSON文字列長）
      memoryUsage += JSON.stringify(entry.data).length * 2 // 文字あたり2バイト概算
    }

    const total = this.hits + this.misses
    const hitRate = total > 0 ? this.hits / total : 0

    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate,
      memoryUsage,
      oldestEntry,
      newestEntry,
    }
  }

  /**
   * 統計リセット
   */
  resetStats(): void {
    this.hits = 0
    this.misses = 0
  }
}

/**
 * グローバルキャッシュインスタンス
 */
class GlobalCache {
  private caches = new Map<string, LRUCache<any>>()

  getCache<T>(name: string, maxSize?: number, defaultTTL?: number): LRUCache<T> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new LRUCache<T>(maxSize, defaultTTL))
    }
    return this.caches.get(name)!
  }

  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {}
    for (const [name, cache] of this.caches) {
      stats[name] = cache.getStats()
    }
    return stats
  }

  cleanupAll(): Record<string, number> {
    const results: Record<string, number> = {}
    for (const [name, cache] of this.caches) {
      results[name] = cache.cleanup()
    }
    return results
  }

  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear()
    }
  }
}

const globalCache = new GlobalCache()

/**
 * キャッシュ取得ヘルパー
 */
export function getCache<T>(name: string, maxSize?: number, defaultTTL?: number): LRUCache<T> {
  return globalCache.getCache<T>(name, maxSize, defaultTTL)
}

/**
 * キャッシュ可能関数デコレータ
 */
export function cached<T>(
  cacheName: string,
  keyGenerator: (...args: any[]) => string,
  ttl?: number
) {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value
    const cache = getCache<T>(cacheName)

    descriptor.value = async function (...args: any[]) {
      const key = keyGenerator(...args)

      // キャッシュヒット確認
      const cached = cache.get(key)
      if (cached !== null) {
        return cached
      }

      // キャッシュミス - 実際の処理実行
      const result = await method.apply(this, args)

      // 結果をキャッシュに保存
      cache.set(key, result, ttl)

      return result
    }
  }
}

/**
 * データベースクエリキャッシュヘルパー
 */
export async function cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttl: number = 300000 // 5分
): Promise<T> {
  const cache = getCache<T>('database-queries', 500, ttl)

  const cached = cache.get(cacheKey)
  if (cached !== null) {
    return cached
  }

  const result = await queryFn()
  cache.set(cacheKey, result, ttl)

  return result
}

/**
 * API応答キャッシュヘルパー
 */
export async function cachedApiResponse<T>(
  cacheKey: string,
  apiFn: () => Promise<T>,
  ttl: number = 60000 // 1分
): Promise<T> {
  const cache = getCache<T>('api-responses', 200, ttl)

  const cached = cache.get(cacheKey)
  if (cached !== null) {
    return cached
  }

  const result = await apiFn()
  cache.set(cacheKey, result, ttl)

  return result
}

/**
 * 制約検証結果キャッシュ
 */
export async function cachedConstraintValidation<T>(
  schedules: any[],
  constraints: string[],
  validationFn: () => Promise<T>,
  ttl: number = 120000 // 2分
): Promise<T> {
  const cache = getCache<T>('constraint-validations', 100, ttl)

  // スケジュールデータのハッシュを生成してキャッシュキーとする
  const scheduleHash = hashObject(schedules)
  const constraintHash = hashObject(constraints)
  const cacheKey = `${scheduleHash}-${constraintHash}`

  const cached = cache.get(cacheKey)
  if (cached !== null) {
    return cached
  }

  const result = await validationFn()
  cache.set(cacheKey, result, ttl)

  return result
}

/**
 * オブジェクトハッシュ生成（簡易版）
 */
function hashObject(obj: any): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort())
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // 32bit整数に変換
  }
  return hash.toString(36)
}

/**
 * 全キャッシュ統計取得
 */
export function getAllCacheStats(): Record<string, CacheStats> {
  return globalCache.getAllStats()
}

/**
 * 全キャッシュクリーンアップ
 */
export function cleanupAllCaches(): Record<string, number> {
  return globalCache.cleanupAll()
}

/**
 * 全キャッシュクリア
 */
export function clearAllCaches(): void {
  globalCache.clearAll()
}

/**
 * 自動クリーンアップの定期実行
 */
export function startCacheCleanup(intervalMs: number = 600000) {
  // 10分間隔
  setInterval(() => {
    const results = cleanupAllCaches()
    const totalCleaned = Object.values(results).reduce((sum, count) => sum + count, 0)
    if (totalCleaned > 0) {
      console.log(`Cache cleanup: removed ${totalCleaned} expired entries`)
    }
  }, intervalMs)
}
