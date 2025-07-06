/**
 * パフォーマンス監視システム
 * API応答時間、メモリ使用量、データベースパフォーマンスの計測
 */

import type { Context } from 'hono'

// パフォーマンスメトリクス型定義
export interface PerformanceMetrics {
  endpoint: string
  method: string
  duration: number
  timestamp: string
  memoryUsage?: NodeJS.MemoryUsage
  databaseQueryCount?: number
  databaseQueryTime?: number
  cacheHits?: number
  cacheMisses?: number
  statusCode: number
  errorMessage?: string
}

// メトリクス収集クラス
class PerformanceCollector {
  private metrics: PerformanceMetrics[] = []
  private readonly maxMetrics = 1000 // メモリ制限のため最大1000件保持

  addMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric)

    // メトリクス数制限
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  getMetrics(filter?: {
    endpoint?: string
    method?: string
    minDuration?: number
    maxDuration?: number
    since?: Date
  }): PerformanceMetrics[] {
    let filtered = this.metrics

    if (filter) {
      filtered = this.metrics.filter(metric => {
        if (filter.endpoint && !metric.endpoint.includes(filter.endpoint)) return false
        if (filter.method && metric.method !== filter.method) return false
        if (filter.minDuration && metric.duration < filter.minDuration) return false
        if (filter.maxDuration && metric.duration > filter.maxDuration) return false
        if (filter.since && new Date(metric.timestamp) < filter.since) return false
        return true
      })
    }

    return filtered
  }

  getStatistics(timeWindow?: number): {
    totalRequests: number
    averageResponseTime: number
    p95ResponseTime: number
    errorRate: number
    slowestEndpoints: Array<{ endpoint: string; averageTime: number; count: number }>
    fastestEndpoints: Array<{ endpoint: string; averageTime: number; count: number }>
    memoryTrends: Array<{ timestamp: string; heapUsed: number; external: number }>
  } {
    const windowStart = timeWindow ? Date.now() - timeWindow : 0
    const windowMetrics = this.metrics.filter(m => new Date(m.timestamp).getTime() > windowStart)

    if (windowMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        errorRate: 0,
        slowestEndpoints: [],
        fastestEndpoints: [],
        memoryTrends: [],
      }
    }

    // 基本統計
    const durations = windowMetrics.map(m => m.duration).sort((a, b) => a - b)
    const errorCount = windowMetrics.filter(m => m.statusCode >= 400).length

    // パーセンタイル計算
    const p95Index = Math.floor(durations.length * 0.95)
    const p95ResponseTime = durations[p95Index] || 0

    // エンドポイント別統計
    const endpointStats = new Map<string, { total: number; count: number }>()
    windowMetrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`
      const current = endpointStats.get(key) || { total: 0, count: 0 }
      endpointStats.set(key, {
        total: current.total + metric.duration,
        count: current.count + 1,
      })
    })

    const endpointAverages = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: stats.total / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.averageTime - a.averageTime)

    // メモリトレンド
    const memoryTrends = windowMetrics
      .filter(m => m.memoryUsage)
      .map(m => ({
        timestamp: m.timestamp,
        heapUsed: m.memoryUsage!.heapUsed / 1024 / 1024, // MB
        external: m.memoryUsage!.external / 1024 / 1024, // MB
      }))
      .slice(-50) // 最新50件

    return {
      totalRequests: windowMetrics.length,
      averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95ResponseTime,
      errorRate: errorCount / windowMetrics.length,
      slowestEndpoints: endpointAverages.slice(0, 10),
      fastestEndpoints: endpointAverages.slice(-10).reverse(),
      memoryTrends,
    }
  }

  clearMetrics() {
    this.metrics = []
  }
}

// グローバルコレクター
const globalCollector = new PerformanceCollector()

/**
 * パフォーマンス監視ミドルウェア
 */
export function performanceMonitor() {
  return async (c: Context, next: () => Promise<void>) => {
    const startTime = Date.now()
    const startMemory = process.memoryUsage?.() // Workers環境では利用不可の場合がある

    let statusCode = 200
    let errorMessage: string | undefined

    try {
      await next()
      statusCode = c.res.status
    } catch (error: any) {
      statusCode = 500
      errorMessage = error.message
      throw error
    } finally {
      const endTime = Date.now()
      const duration = endTime - startTime

      const metric: PerformanceMetrics = {
        endpoint: c.req.path,
        method: c.req.method,
        duration,
        timestamp: new Date().toISOString(),
        memoryUsage: startMemory,
        statusCode,
        errorMessage,
      }

      globalCollector.addMetric(metric)

      // 遅いリクエストをログ出力
      if (duration > 1000) {
        // 1秒以上
        console.warn(
          `Slow request detected: ${metric.method} ${metric.endpoint} took ${duration}ms`
        )
      }
    }
  }
}

/**
 * パフォーマンス統計取得
 */
export function getPerformanceStatistics(timeWindow?: number) {
  return globalCollector.getStatistics(timeWindow)
}

/**
 * パフォーマンスメトリクス取得
 */
export function getPerformanceMetrics(filter?: Parameters<typeof globalCollector.getMetrics>[0]) {
  return globalCollector.getMetrics(filter)
}

/**
 * メトリクスクリア
 */
export function clearPerformanceMetrics() {
  globalCollector.clearMetrics()
}

/**
 * データベースクエリパフォーマンス追跡
 */
export class DatabaseQueryTracker {
  private queryCount = 0
  private totalQueryTime = 0

  async trackQuery<T>(queryName: string, queryFn: () => Promise<T>): Promise<T> {
    const startTime = Date.now()
    this.queryCount++

    try {
      const result = await queryFn()
      const duration = Date.now() - startTime
      this.totalQueryTime += duration

      // 遅いクエリをログ出力
      if (duration > 500) {
        // 500ms以上
        console.warn(`Slow database query: ${queryName} took ${duration}ms`)
      }

      return result
    } catch (error) {
      console.error(`Database query error in ${queryName}:`, error)
      throw error
    }
  }

  getStats() {
    return {
      queryCount: this.queryCount,
      totalQueryTime: this.totalQueryTime,
      averageQueryTime: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
    }
  }

  reset() {
    this.queryCount = 0
    this.totalQueryTime = 0
  }
}

/**
 * API応答時間ベンチマーク
 */
export async function benchmarkEndpoint(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string
    iterations?: number
    concurrency?: number
  } = {}
): Promise<{
  averageTime: number
  minTime: number
  maxTime: number
  p95Time: number
  successRate: number
  results: Array<{ duration: number; status: number; success: boolean }>
}> {
  const { method = 'GET', headers = {}, body, iterations = 10, concurrency = 1 } = options

  const results: Array<{ duration: number; status: number; success: boolean }> = []

  // 並行実行のためのバッチ処理
  const batches = Math.ceil(iterations / concurrency)

  for (let batch = 0; batch < batches; batch++) {
    const batchPromises = []
    const batchSize = Math.min(concurrency, iterations - batch * concurrency)

    for (let i = 0; i < batchSize; i++) {
      batchPromises.push(
        (async () => {
          const startTime = Date.now()
          let status = 0
          let success = false

          try {
            const response = await fetch(url, {
              method,
              headers,
              body,
            })
            status = response.status
            success = response.ok
          } catch (error) {
            status = 0
            success = false
          }

          const duration = Date.now() - startTime
          return { duration, status, success }
        })()
      )
    }

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
  }

  // 統計計算
  const durations = results.map(r => r.duration).sort((a, b) => a - b)
  const successCount = results.filter(r => r.success).length
  const p95Index = Math.floor(durations.length * 0.95)

  return {
    averageTime: durations.reduce((a, b) => a + b, 0) / durations.length,
    minTime: Math.min(...durations),
    maxTime: Math.max(...durations),
    p95Time: durations[p95Index] || 0,
    successRate: successCount / results.length,
    results,
  }
}
