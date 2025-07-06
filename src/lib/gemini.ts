/**
 * Gemini API連携ヘルパー関数
 * 時間割生成でGemini 2.5 Proを使用するためのユーティリティ
 */

interface GeminiContent {
  parts: Array<{
    text: string
  }>
}

interface GeminiRequest {
  contents: GeminiContent[]
  generationConfig?: {
    temperature?: number
    maxOutputTokens?: number
    topP?: number
    topK?: number
  }
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string
      }>
      role: string
    }
    finishReason: string
    index: number
    safetyRatings: Array<{
      category: string
      probability: string
    }>
  }>
  usageMetadata: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

interface GeminiError {
  error: {
    code: number
    message: string
    status: string
  }
}

export interface TimetableGenerationResult {
  success: boolean
  data?: any
  error?: string
  message?: string
  retryable?: boolean
}

/**
 * Gemini APIを呼び出して時間割を生成
 */
export async function generateTimetableWithGemini(
  prompt: string,
  apiKey: string,
  priority: 'speed' | 'quality' | 'balanced' = 'balanced'
): Promise<TimetableGenerationResult> {
  try {
    const generationConfig = getGenerationConfigForPriority(priority)

    const request: GeminiRequest = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig,
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    )

    if (!response.ok) {
      const errorData = (await response.json()) as GeminiError
      console.error('Gemini API Error:', errorData)

      // リトライ可能なエラーかどうかを判断
      const retryable = response.status >= 500 || response.status === 429

      return {
        success: false,
        error: errorData.error?.status || 'GEMINI_API_ERROR',
        message: errorData.error?.message || 'Gemini APIでエラーが発生しました',
        retryable,
      }
    }

    const geminiResponse = (await response.json()) as GeminiResponse

    // レスポンスからテキストを抽出
    if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
      return {
        success: false,
        error: 'NO_CANDIDATES_GENERATED',
        message: 'Gemini APIから候補が生成されませんでした',
        retryable: true,
      }
    }

    const candidate = geminiResponse.candidates[0]
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      return {
        success: false,
        error: 'NO_CONTENT_GENERATED',
        message: 'Gemini APIから有効な内容が生成されませんでした',
        retryable: true,
      }
    }

    const generatedText = candidate.content.parts.map(part => part.text).join('')

    if (!generatedText) {
      return {
        success: false,
        error: 'EMPTY_CONTENT_GENERATED',
        message: 'Gemini APIから空の内容が生成されました',
        retryable: true,
      }
    }

    // JSON形式で返されることを想定して解析を試行
    let parsedData
    try {
      // コードブロックが含まれている場合は抽出
      const jsonMatch =
        generatedText.match(/```json\s*([\s\S]*?)\s*```/) ||
        generatedText.match(/```\s*([\s\S]*?)\s*```/)

      const jsonText = jsonMatch ? jsonMatch[1] : generatedText
      parsedData = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('JSON解析エラー:', parseError)
      console.error('生成されたテキスト:', generatedText)
      return {
        success: false,
        error: 'INVALID_JSON_RESPONSE',
        message: 'Gemini APIからの応答が有効なJSON形式ではありません',
        retryable: true,
      }
    }

    return {
      success: true,
      data: parsedData,
    }
  } catch (error) {
    console.error('Gemini API呼び出しエラー:', error)
    return {
      success: false,
      error: 'GEMINI_API_CALL_ERROR',
      message: 'Gemini APIの呼び出しに失敗しました',
      retryable: true,
    }
  }
}

/**
 * 優先度に応じてgenerationConfigを設定
 */
function getGenerationConfigForPriority(priority: 'speed' | 'quality' | 'balanced') {
  switch (priority) {
    case 'speed':
      return {
        temperature: 0.3,
        maxOutputTokens: 4000,
        topP: 0.8,
        topK: 20,
      }
    case 'quality':
      return {
        temperature: 0.7,
        maxOutputTokens: 8000,
        topP: 0.95,
        topK: 40,
      }
    case 'balanced':
    default:
      return {
        temperature: 0.5,
        maxOutputTokens: 6000,
        topP: 0.9,
        topK: 30,
      }
  }
}

/**
 * Gemini APIキーが設定されているかチェック
 */
export function validateGeminiApiKey(apiKey: string | undefined): boolean {
  return !!(apiKey && apiKey.length > 20)
}
