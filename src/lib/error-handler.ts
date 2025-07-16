/**
 * 統一エラーハンドリングシステム
 * フロントエンドでの一貫したエラー処理をサポート
 */

import type { Context } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'

// エラーコード定義
export const ERROR_CODES = {
  // バリデーションエラー
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // リソースエラー
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',

  // 認証・認可エラー
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  FORBIDDEN_OPERATION: 'FORBIDDEN_OPERATION',
  INVALID_REQUEST: 'INVALID_REQUEST',

  // 外部API関連エラー
  GROQ_API_ERROR: 'GROQ_API_ERROR',
  GROQ_API_KEY_INVALID: 'GROQ_API_KEY_INVALID',
  GROQ_QUOTA_EXCEEDED: 'GROQ_QUOTA_EXCEEDED',

  // システムエラー
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',

  // 時間割生成関連エラー
  TIMETABLE_GENERATION_FAILED: 'TIMETABLE_GENERATION_FAILED',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  INVALID_SCHEDULE_DATA: 'INVALID_SCHEDULE_DATA',

  // 制約条件関連エラー
  CONSTRAINT_NOT_FOUND: 'CONSTRAINT_NOT_FOUND',
  CONSTRAINT_VALIDATION_FAILED: 'CONSTRAINT_VALIDATION_FAILED',
  INVALID_CONSTRAINT_CONFIG: 'INVALID_CONSTRAINT_CONFIG',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

// エラーレスポンス型定義
export interface ErrorResponse {
  success: false
  error: ErrorCode
  message: string
  details?: string[]
  timestamp: string
  requestId?: string
  retryable?: boolean
  helpUrl?: string
}

// エラー詳細情報
interface ErrorInfo {
  statusCode: StatusCode
  message: string
  retryable: boolean
  helpUrl?: string
}

// エラーコードマッピング
const ERROR_INFO_MAP: Record<ErrorCode, ErrorInfo> = {
  // バリデーションエラー (400)
  [ERROR_CODES.VALIDATION_FAILED]: {
    statusCode: 400,
    message: 'リクエストデータの検証に失敗しました',
    retryable: false,
    helpUrl: '/docs/ui#validation',
  },
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: {
    statusCode: 400,
    message: '必須フィールドが不足しています',
    retryable: false,
  },
  [ERROR_CODES.INVALID_FORMAT]: {
    statusCode: 400,
    message: 'データ形式が正しくありません',
    retryable: false,
  },

  // リソースエラー
  [ERROR_CODES.RESOURCE_NOT_FOUND]: {
    statusCode: 404,
    message: '指定されたリソースが見つかりません',
    retryable: false,
  },
  [ERROR_CODES.RESOURCE_ALREADY_EXISTS]: {
    statusCode: 409,
    message: '指定されたリソースは既に存在します',
    retryable: false,
  },
  [ERROR_CODES.RESOURCE_CONFLICT]: {
    statusCode: 409,
    message: 'リソースの競合が発生しました',
    retryable: true,
  },

  // 認証・認可エラー
  [ERROR_CODES.UNAUTHORIZED]: {
    statusCode: 401,
    message: '認証が必要です',
    retryable: false,
    helpUrl: '/docs/ui#authentication',
  },
  [ERROR_CODES.FORBIDDEN]: {
    statusCode: 403,
    message: 'この操作を実行する権限がありません',
    retryable: false,
  },
  [ERROR_CODES.INVALID_TOKEN]: {
    statusCode: 401,
    message: '無効な認証トークンです',
    retryable: false,
  },

  // 外部API関連エラー
  [ERROR_CODES.GEMINI_API_ERROR]: {
    statusCode: 502,
    message: 'Gemini API との通信でエラーが発生しました',
    retryable: true,
  },
  [ERROR_CODES.GEMINI_API_KEY_INVALID]: {
    statusCode: 401,
    message: 'Gemini API キーが無効です',
    retryable: false,
    helpUrl: '/docs/ui#gemini-setup',
  },
  [ERROR_CODES.GEMINI_QUOTA_EXCEEDED]: {
    statusCode: 429,
    message: 'Gemini API の利用制限に達しました',
    retryable: true,
  },

  // システムエラー
  [ERROR_CODES.INTERNAL_ERROR]: {
    statusCode: 500,
    message: 'サーバー内部エラーが発生しました',
    retryable: true,
  },
  [ERROR_CODES.DATABASE_ERROR]: {
    statusCode: 500,
    message: 'データベースエラーが発生しました',
    retryable: true,
  },
  [ERROR_CODES.TIMEOUT_ERROR]: {
    statusCode: 504,
    message: '処理がタイムアウトしました',
    retryable: true,
  },

  // 時間割生成関連エラー
  [ERROR_CODES.TIMETABLE_GENERATION_FAILED]: {
    statusCode: 422,
    message: '時間割生成に失敗しました',
    retryable: true,
    helpUrl: '/docs/ui#timetable-generation',
  },
  [ERROR_CODES.CONSTRAINT_VIOLATION]: {
    statusCode: 422,
    message: '制約条件に違反しています',
    retryable: false,
    helpUrl: '/docs/ui#constraints',
  },
  [ERROR_CODES.INVALID_SCHEDULE_DATA]: {
    statusCode: 400,
    message: '時間割データが正しくありません',
    retryable: false,
  },

  // 制約条件関連エラー
  [ERROR_CODES.CONSTRAINT_NOT_FOUND]: {
    statusCode: 404,
    message: '指定された制約条件が見つかりません',
    retryable: false,
  },
  [ERROR_CODES.CONSTRAINT_VALIDATION_FAILED]: {
    statusCode: 422,
    message: '制約条件の検証に失敗しました',
    retryable: false,
  },
  [ERROR_CODES.INVALID_CONSTRAINT_CONFIG]: {
    statusCode: 400,
    message: '制約条件の設定が正しくありません',
    retryable: false,
  },
}

/**
 * 統一エラーレスポンス生成
 */
export function createErrorResponse(
  errorCode: ErrorCode,
  customMessage?: string,
  details?: string[],
  requestId?: string
): ErrorResponse {
  const errorInfo = ERROR_INFO_MAP[errorCode]

  return {
    success: false,
    error: errorCode,
    message: customMessage || errorInfo.message,
    details,
    timestamp: new Date().toISOString(),
    requestId,
    retryable: errorInfo.retryable,
    helpUrl: errorInfo.helpUrl,
  }
}

/**
 * Hono Context でのエラーレスポンス送信
 */
export function sendErrorResponse(
  c: Context,
  errorCode: ErrorCode,
  customMessage?: string,
  details?: string[],
  requestId?: string
) {
  const errorInfo = ERROR_INFO_MAP[errorCode]
  const errorResponse = createErrorResponse(errorCode, customMessage, details, requestId)

  console.error(`[${errorCode}] ${errorResponse.message}`, {
    requestId,
    details,
    timestamp: errorResponse.timestamp,
    url: c.req.url,
    method: c.req.method,
  })

  return c.json(errorResponse, errorInfo.statusCode)
}

/**
 * バリデーションエラーの詳細化
 */
export function createValidationErrorResponse(
  validationErrors: Array<{ field: string; message: string }>,
  requestId?: string
): ErrorResponse {
  const details = validationErrors.map(err => `${err.field}: ${err.message}`)

  return createErrorResponse(
    ERROR_CODES.VALIDATION_FAILED,
    `${validationErrors.length}個のバリデーションエラーがあります`,
    details,
    requestId
  )
}

/**
 * 外部API エラーの変換
 */
export function convertGeminiError(error: any, requestId?: string): ErrorResponse {
  if (error.message?.includes('API key')) {
    return createErrorResponse(ERROR_CODES.GEMINI_API_KEY_INVALID, undefined, undefined, requestId)
  }

  if (error.message?.includes('quota') || error.message?.includes('limit')) {
    return createErrorResponse(ERROR_CODES.GEMINI_QUOTA_EXCEEDED, undefined, undefined, requestId)
  }

  return createErrorResponse(
    ERROR_CODES.GEMINI_API_ERROR,
    `Gemini API エラー: ${error.message}`,
    undefined,
    requestId
  )
}

/**
 * データベースエラーの変換
 */
export function convertDatabaseError(error: any, requestId?: string): ErrorResponse {
  if (error.message?.includes('UNIQUE constraint')) {
    return createErrorResponse(
      ERROR_CODES.RESOURCE_ALREADY_EXISTS,
      'データが既に存在します',
      [error.message],
      requestId
    )
  }

  if (error.message?.includes('NOT NULL constraint')) {
    return createErrorResponse(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      '必須フィールドが不足しています',
      [error.message],
      requestId
    )
  }

  return createErrorResponse(
    ERROR_CODES.DATABASE_ERROR,
    `データベースエラー: ${error.message}`,
    undefined,
    requestId
  )
}

/**
 * リクエストID生成
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * エラーハンドリングミドルウェア
 */
export function errorHandler() {
  return async (c: Context, next: () => Promise<void>) => {
    const requestId = generateRequestId()
    c.set('requestId', requestId)

    try {
      await next()
    } catch (error: any) {
      console.error('Unhandled error:', error, { requestId })

      // 既知のエラータイプに応じて適切なレスポンスを生成
      if (error.name === 'ZodError') {
        const validationErrors = error.errors.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }))
        const errorResponse = createValidationErrorResponse(validationErrors, requestId)
        return c.json(errorResponse, 400)
      }

      // データベースエラー
      if (error.code && error.code.startsWith('SQLITE_')) {
        const errorResponse = convertDatabaseError(error, requestId)
        return c.json(errorResponse, ERROR_INFO_MAP[errorResponse.error].statusCode)
      }

      // デフォルトの内部エラー
      const errorResponse = createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'サーバー内部エラーが発生しました',
        [error.message],
        requestId
      )
      return c.json(errorResponse, 500)
    }
  }
}
