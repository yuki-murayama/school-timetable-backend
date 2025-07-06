/**
 * テスト環境のセットアップ
 */

import { beforeEach } from 'vitest'

// テスト用のモック環境変数
const mockEnv = {
  DB: {
    prepare: () => ({
      bind: () => ({
        all: () => Promise.resolve([]),
        run: () => Promise.resolve({ success: true }),
        first: () => Promise.resolve(null),
      }),
    }),
  },
} as any

beforeEach(() => {
  // 各テスト前にモック環境をリセット
  globalThis.mockEnv = mockEnv
})