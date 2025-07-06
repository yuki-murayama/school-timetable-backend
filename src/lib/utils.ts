/**
 * ユーティリティ関数
 * D1に依存しない純粋な関数
 */

/**
 * エラーレスポンスを生成
 */
export function createErrorResponse(error: string, message: string, status = 500) {
  return {
    error,
    message,
    status,
  }
}

/**
 * 成功レスポンスを生成
 */
export function createSuccessResponse<T>(data: T, status = 200) {
  return {
    success: true,
    data,
    status,
  }
}

/**
 * 学校名をサニタイズ
 */
export function sanitizeSchoolName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/**
 * 学年を正規化（1-6の範囲チェック）
 */
export function normalizeGrade(grade: number): number {
  if (grade < 1 || grade > 6) {
    throw new Error('学年は1-6の範囲で指定してください')
  }
  return Math.floor(grade)
}

/**
 * クラス名を正規化
 */
export function normalizeClassName(name: string, grade: number): string {
  const sanitized = name.trim()

  // 学年が含まれていない場合は先頭に追加
  if (!sanitized.includes(`${grade}年`)) {
    return `${grade}年${sanitized}`
  }

  return sanitized
}

/**
 * 教師名を正規化
 */
export function normalizeTeacherName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/**
 * IDの形式チェック（CUID2形式）
 */
export function isValidId(id: string): boolean {
  // CUID2は小文字のアルファベットと数字、25文字
  return /^[a-z0-9]{25}$/.test(id)
}

/**
 * 日付文字列の生成
 */
export function createTimestamp(): string {
  return new Date().toISOString()
}
