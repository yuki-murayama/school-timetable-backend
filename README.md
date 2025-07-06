# 📖 School Timetable API ドキュメント

## 🚀 APIドキュメント機能

このプロジェクトには、包括的で使いやすいAPIドキュメントシステムが組み込まれています。

### 📋 利用可能なドキュメント

| URL | 説明 | 特徴 |
|-----|------|------|
| `/docs` | ドキュメントホーム | 美しいランディングページ |
| `/docs/ui` | Swagger UI | インタラクティブなAPI試行 |
| `/docs/doc` | OpenAPI仕様書 | 機械可読なJSON形式 |

### 🔧 機能一覧

#### 📊 Swagger UI の特徴
- **インタラクティブ試行**: ブラウザから直接APIを呼び出し可能
- **リアルタイムバリデーション**: リクエストデータの検証
- **詳細なスキーマ表示**: 各エンドポイントの詳細情報
- **日本語対応**: 完全日本語化されたドキュメント
- **カテゴリ別整理**: 機能別にAPIを分類

#### 📋 カバーされているAPI

1. **🏫 学校管理** (`/api/schools`)
   - 学校の作成・取得・更新・削除

2. **📚 クラス管理** (`/api/classes`) 
   - クラスの編成・学年設定

3. **👨‍🏫 教師管理** (`/api/teachers`)
   - 教師情報・担当教科管理

4. **📖 教科管理** (`/api/subjects`)
   - 教科の登録・設定

5. **🏛️ 教室管理** (`/api/classrooms`)
   - 教室タイプ・定員管理

6. **📅 時間割管理** (`/api/timetables`)
   - 時間割作成・AI生成・管理

7. **🔧 制約条件管理** (`/api/constraints`)
   - 拡張可能な制約システム

### 🎯 制約条件システムの詳細ドキュメント

制約条件システムは特に詳細にドキュメント化されており、以下の情報が含まれています：

#### 標準制約条件
- **`teacher_conflict`**: 教師時間重複禁止
- **`classroom_conflict`**: 教室時間重複禁止  
- **`subject_distribution`**: 教科配置バランス
- **`time_slot_preference`**: 時間帯配置優先

#### API操作例
```bash
# 制約条件一覧取得
GET /api/constraints

# 制約設定更新
PATCH /api/constraints/teacher_conflict
{
  "enabled": true,
  "parameters": {
    "strictMode": false,
    "allowPartTime": true
  }
}

# 制約検証実行
POST /api/constraints/validate/{timetableId}
{
  "schedules": [...],
  "schoolId": "sch_xxx",
  "enabledConstraints": ["teacher_conflict"]
}
```

### 🛠️ 開発者向け情報

#### パッケージ依存関係
```json
{
  "@hono/swagger-ui": "^0.5.0",
  "@hono/zod-openapi": "^0.19.1"
}
```

#### ドキュメント生成の仕組み
1. **Zodスキーマ**: 自動的にOpenAPIスキーマに変換
2. **型安全性**: TypeScriptの型定義と自動同期
3. **バリデーション**: 実際のAPIと完全一致
4. **サンプルデータ**: 実用的な例を自動生成

#### カスタマイズ
新しいAPIエンドポイントを追加する際：

1. `src/routes/docs/` に新しいルート定義ファイルを作成
2. `src/lib/openapi.ts` にスキーマを追加
3. `src/routes/docs/index.ts` でルートを登録

例：
```typescript
// src/routes/docs/my-feature.ts
export const myFeatureRoute = createAPIRoute({
  method: 'get',
  path: '/api/my-feature',
  tags: ['MyFeature'],
  summary: '新機能',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MyFeatureSchema
        }
      }
    }
  }
})
```

### 🚀 デプロイ後の確認

デプロイ後、以下のURLでドキュメントが利用可能になります：

**本番環境:**
- https://school-timetable-backend.malah-shunmu.workers.dev/docs/ui

**開発環境:**
- http://localhost:3000/docs/ui

### 📱 モバイル対応

Swagger UIはレスポンシブデザインに対応しており、スマートフォンやタブレットからでも快適にAPIドキュメントを閲覧・操作できます。

### 🔍 テスト機能

`test-docs.sh` スクリプトを使用してドキュメント機能をテストできます：

```bash
./test-docs.sh
```

### 🌟 今後の拡張予定

- **認証システム**: JWT トークンベースの認証
- **API使用例**: より詳細なコード例
- **多言語対応**: 英語版の提供
- **パフォーマンス情報**: レスポンス時間の表示
- **エラーコード辞書**: 詳細なエラー説明

---

## 💡 使い方のヒント

1. **API探索**: Swagger UIの「Try it out」ボタンで実際のレスポンスを確認
2. **スキーマ確認**: モデル定義セクションでデータ構造を理解
3. **エラー対応**: レスポンス例を参考にエラーハンドリングを実装
4. **制約理解**: 制約条件APIで複雑なビジネスルールを把握

これらのドキュメントを活用して、効率的にSchool Timetable APIを利用してください！