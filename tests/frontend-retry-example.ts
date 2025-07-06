/**
 * フロントエンド側リトライ実装例
 * Workers側は単発実行のみで、リトライ制御はフロントエンド側で行う
 */

interface TimetableGenerationRequest {
  timetableId: string
  requirements?: string
  priority: 'speed' | 'quality' | 'balanced'
}

interface TimetableGenerationResponse {
  success: boolean
  data?: {
    timetableId: string
    slotsCreated: number
    message: string
  }
  error?: string
  message?: string
  retryable?: boolean
}

/**
 * 時間割生成（リトライ機能付き）
 */
export async function generateTimetableWithRetry(
  request: TimetableGenerationRequest,
  maxRetries: number = 5,
  onProgress?: (attempt: number, error?: string) => void
): Promise<TimetableGenerationResponse> {
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      onProgress?.(attempt)
      
      const response = await fetch(`/api/timetables/${request.timetableId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      const result: TimetableGenerationResponse = await response.json()

      if (result.success) {
        return result
      }

      // リトライ不可能なエラーの場合は即座に終了
      if (!result.retryable) {
        return result
      }

      onProgress?.(attempt, result.message)

      // 最後の試行でない場合は少し待機
      if (attempt < maxRetries) {
        await sleep(1000 * attempt) // 1秒、2秒、3秒...
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '通信エラー'
      onProgress?.(attempt, errorMessage)

      if (attempt === maxRetries) {
        return {
          success: false,
          error: 'NETWORK_ERROR',
          message: errorMessage
        }
      }

      await sleep(1000 * attempt)
    }
  }

  return {
    success: false,
    error: 'MAX_RETRIES_EXCEEDED',
    message: `最大リトライ回数 (${maxRetries}) に達しました`
  }
}

/**
 * React Hook使用例
 */
export function useTimetableGeneration() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentAttempt, setCurrentAttempt] = useState(0)
  const [lastError, setLastError] = useState<string>()

  const generateTimetable = async (request: TimetableGenerationRequest) => {
    setIsGenerating(true)
    setCurrentAttempt(0)
    setLastError(undefined)

    try {
      const result = await generateTimetableWithRetry(
        request,
        5,
        (attempt, error) => {
          setCurrentAttempt(attempt)
          if (error) {
            setLastError(error)
          }
        }
      )

      return result
    } finally {
      setIsGenerating(false)
    }
  }

  return {
    generateTimetable,
    isGenerating,
    currentAttempt,
    lastError
  }
}

/**
 * ユーザーインターフェース例
 */
function TimetableGenerationPage() {
  const { generateTimetable, isGenerating, currentAttempt, lastError } = useTimetableGeneration()

  const handleGenerate = async () => {
    const result = await generateTimetable({
      timetableId: 'xxx',
      requirements: '数学の授業を午前中に配置してください',
      priority: 'balanced'
    })

    if (result.success) {
      alert(`時間割生成完了！${result.data?.slotsCreated}個のスロットを作成しました`)
    } else {
      alert(`エラー: ${result.message}`)
    }
  }

  return (
    <div>
      <button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? '生成中...' : '時間割生成'}
      </button>
      
      {isGenerating && (
        <div>
          <p>試行回数: {currentAttempt}/5</p>
          {lastError && <p>エラー: {lastError}</p>}
          <div>
            <div style={{ width: `${(currentAttempt / 5) * 100}%`, backgroundColor: 'blue', height: '4px' }} />
          </div>
        </div>
      )}
    </div>
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// TypeScript型定義のエクスポート
export type {
  TimetableGenerationRequest,
  TimetableGenerationResponse
}