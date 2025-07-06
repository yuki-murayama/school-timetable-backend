/**
 * パフォーマンス監視API
 * システムパフォーマンスの可視化と最適化支援
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { 
  getPerformanceStatistics, 
  getPerformanceMetrics, 
  clearPerformanceMetrics,
  benchmarkEndpoint 
} from '../lib/performance-monitor'
import { 
  getAllCacheStats, 
  cleanupAllCaches, 
  clearAllCaches,
  getCache
} from '../lib/cache-system'
import { sendErrorResponse, ERROR_CODES, errorHandler } from '../lib/error-handler'

const app = new Hono()
app.use('*', errorHandler())

// パフォーマンス統計取得
const StatisticsQuerySchema = z.object({
  timeWindow: z.string().optional().transform(val => val ? parseInt(val) : undefined)
})

app.get('/statistics',
  zValidator('query', StatisticsQuerySchema),
  (c) => {
    const { timeWindow } = c.req.valid('query')
    const requestId = c.get('requestId')
    
    try {
      const stats = getPerformanceStatistics(timeWindow)
      
      return c.json({
        success: true,
        data: {
          ...stats,
          timeWindowMs: timeWindow,
          generatedAt: new Date().toISOString()
        },
        requestId
      })
    } catch (error: any) {
      return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
    }
  }
)

// 詳細メトリクス取得
const MetricsQuerySchema = z.object({
  endpoint: z.string().optional(),
  method: z.string().optional(),
  minDuration: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  maxDuration: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  since: z.string().optional().transform(val => val ? new Date(val) : undefined),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 100)
})

app.get('/metrics',
  zValidator('query', MetricsQuerySchema),
  (c) => {
    const { limit, ...filter } = c.req.valid('query')
    const requestId = c.get('requestId')
    
    try {
      const metrics = getPerformanceMetrics(filter)
      const limitedMetrics = metrics.slice(-limit!) // 最新N件
      
      return c.json({
        success: true,
        data: {
          metrics: limitedMetrics,
          total: metrics.length,
          filtered: limitedMetrics.length,
          filter
        },
        requestId
      })
    } catch (error: any) {
      return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
    }
  }
)

// キャッシュ統計取得
app.get('/cache/statistics', (c) => {
  const requestId = c.get('requestId')
  
  try {
    const cacheStats = getAllCacheStats()
    
    // 全体サマリー計算
    const totalHits = Object.values(cacheStats).reduce((sum, stats) => sum + stats.hits, 0)
    const totalMisses = Object.values(cacheStats).reduce((sum, stats) => sum + stats.misses, 0)
    const totalSize = Object.values(cacheStats).reduce((sum, stats) => sum + stats.size, 0)
    const totalMemoryUsage = Object.values(cacheStats).reduce((sum, stats) => sum + stats.memoryUsage, 0)
    const overallHitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0
    
    return c.json({
      success: true,
      data: {
        summary: {
          totalCaches: Object.keys(cacheStats).length,
          totalHits,
          totalMisses,
          totalSize,
          overallHitRate,
          totalMemoryUsage: Math.round(totalMemoryUsage / 1024), // KB
        },
        caches: cacheStats
      },
      requestId
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
  }
})

// キャッシュクリーンアップ実行
app.post('/cache/cleanup', (c) => {
  const requestId = c.get('requestId')
  
  try {
    const results = cleanupAllCaches()
    const totalCleaned = Object.values(results).reduce((sum, count) => sum + count, 0)
    
    return c.json({
      success: true,
      data: {
        totalCleaned,
        cacheResults: results
      },
      message: `${totalCleaned}個の期限切れエントリをクリーンアップしました`,
      requestId
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
  }
})

// キャッシュクリア
app.post('/cache/clear', (c) => {
  const requestId = c.get('requestId')
  
  try {
    clearAllCaches()
    
    return c.json({
      success: true,
      message: '全てのキャッシュをクリアしました',
      requestId
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
  }
})

// 特定キャッシュの管理
const CacheActionSchema = z.object({
  pattern: z.string().optional()
})

app.post('/cache/:cacheName/clear',
  zValidator('json', CacheActionSchema),
  (c) => {
    const cacheName = c.req.param('cacheName')
    const { pattern } = c.req.valid('json')
    const requestId = c.get('requestId')
    
    try {
      const cache = getCache(cacheName)
      const cleared = cache.clear(pattern)
      
      return c.json({
        success: true,
        data: { cleared },
        message: `キャッシュ「${cacheName}」から${cleared}個のエントリをクリアしました`,
        requestId
      })
    } catch (error: any) {
      return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
    }
  }
)

// エンドポイントベンチマーク
const BenchmarkSchema = z.object({
  url: z.string().url(),
  method: z.string().default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
  iterations: z.number().min(1).max(100).default(10),
  concurrency: z.number().min(1).max(10).default(1)
})

app.post('/benchmark',
  zValidator('json', BenchmarkSchema),
  async (c) => {
    const benchmarkConfig = c.req.valid('json')
    const requestId = c.get('requestId')
    
    try {
      const results = await benchmarkEndpoint(benchmarkConfig.url, {
        method: benchmarkConfig.method,
        headers: benchmarkConfig.headers,
        body: benchmarkConfig.body,
        iterations: benchmarkConfig.iterations,
        concurrency: benchmarkConfig.concurrency
      })
      
      return c.json({
        success: true,
        data: {
          benchmark: results,
          config: benchmarkConfig,
          executedAt: new Date().toISOString()
        },
        requestId
      })
    } catch (error: any) {
      return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
    }
  }
)

// パフォーマンス推奨事項
app.get('/recommendations', (c) => {
  const requestId = c.get('requestId')
  
  try {
    const stats = getPerformanceStatistics(3600000) // 1時間のデータ
    const cacheStats = getAllCacheStats()
    
    const recommendations = []
    
    // 応答時間ベースの推奨事項
    if (stats.averageResponseTime > 1000) {
      recommendations.push({
        type: 'performance',
        severity: 'high',
        message: `平均応答時間が${stats.averageResponseTime.toFixed(0)}msと遅いです。データベースクエリの最適化をお勧めします。`,
        action: 'データベースインデックスの確認とクエリ最適化'
      })
    }
    
    if (stats.p95ResponseTime > 2000) {
      recommendations.push({
        type: 'performance',
        severity: 'medium',
        message: `95パーセンタイル応答時間が${stats.p95ResponseTime.toFixed(0)}msです。重いエンドポイントの最適化をお勧めします。`,
        action: '最も遅いエンドポイントの分析と改善'
      })
    }
    
    // キャッシュベースの推奨事項
    const totalHits = Object.values(cacheStats).reduce((sum, stats) => sum + stats.hits, 0)
    const totalMisses = Object.values(cacheStats).reduce((sum, stats) => sum + stats.misses, 0)
    const hitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0
    
    if (hitRate < 0.6) {
      recommendations.push({
        type: 'cache',
        severity: 'medium',
        message: `キャッシュヒット率が${(hitRate * 100).toFixed(1)}%と低いです。キャッシュ戦略の見直しをお勧めします。`,
        action: 'キャッシュTTLの調整またはキャッシュ対象の拡大'
      })
    }
    
    // エラー率ベースの推奨事項
    if (stats.errorRate > 0.05) {
      recommendations.push({
        type: 'reliability',
        severity: 'high',
        message: `エラー率が${(stats.errorRate * 100).toFixed(1)}%と高いです。エラーハンドリングの改善をお勧めします。`,
        action: 'エラーログの詳細分析とバグ修正'
      })
    }
    
    // 正常な場合
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'info',
        severity: 'low',
        message: 'システムは正常に動作しています。',
        action: '引き続き監視を継続してください'
      })
    }
    
    return c.json({
      success: true,
      data: {
        recommendations,
        basedOnData: {
          timeWindow: '1 hour',
          totalRequests: stats.totalRequests,
          averageResponseTime: stats.averageResponseTime,
          errorRate: stats.errorRate,
          cacheHitRate: hitRate
        }
      },
      requestId
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
  }
})

// パフォーマンスデータリセット
app.post('/reset', (c) => {
  const requestId = c.get('requestId')
  
  try {
    clearPerformanceMetrics()
    
    return c.json({
      success: true,
      message: 'パフォーマンスメトリクスをリセットしました',
      requestId
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
  }
})

// システムリソース監視
app.get('/system', (c) => {
  const requestId = c.get('requestId')
  
  try {
    const memoryUsage = process.memoryUsage?.() || {
      rss: 0,
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      arrayBuffers: 0
    }
    
    return c.json({
      success: true,
      data: {
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
          arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024) // MB
        },
        timestamp: new Date().toISOString(),
        platform: process.platform || 'unknown',
        nodeVersion: process.version || 'unknown'
      },
      requestId
    })
  } catch (error: any) {
    return sendErrorResponse(c, ERROR_CODES.INTERNAL_ERROR, error.message, undefined, requestId)
  }
})

export default app