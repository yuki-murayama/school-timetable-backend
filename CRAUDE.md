# school-timetable プロジェクト - Claude Code ガイド

## プロジェクト概要

school-timetableは、日本の中学校、高等学校向けの時間割表作成Webアプリケーションです。
React(Next) でフロントエンド、Cloudflare Workers + Hono のサーバーレスバックエンドで構築されています。
レポジトリは、フロントとバック用の2つに分けられています。
こちらはバックエンド用のCRAUDE.mdになります。

* アプリ名: school-timetable
* プロジェクトタイプ: マルチレポジトリ構成のフルスタックアプリケーション
* 主要機能: 時間割生成機能、時間割生成用データ登録機能、Auth0 認証

## 機能概要

クラス数、授業時間数、土曜日の授業有無と時間数、各教科の教師データ、特定教科専用教室（化学室、音楽室、美術室、体育館、グランドなど）などのデータから、AI（Claude API）を使用して適切な時間割を作成するアプリケーションです。
フロントエンドは、時間割生成画面、データ登録画面、生成済みの時間割参照画面を持ち、生成画面の生成ボタンが押されると、バックエンドを呼び出します。
バックエンドがDBから必要なデータを含むプロンプトをAIに渡し、AIからは時間割をJSON形式で受け取ります。
受け取ったJSONデータを、実現不能（同一時間に同一の教師が複数のクラスを担当している、特定教科専用教室を教室数以上に使用している時間があるなど）な時間割となっていないかチェック処理でチェックし、問題があれば再度AIに生成を依頼します。
問題なければ、生成されたデータでDBに登録します。

## 技術スタック

### フロントエンド

* フレームワーク: React 19.1.0 + next 15.2.4
* 言語: TypeScript 5.8.3
* ルーティング: Expo Router 5.0.7
* 認証: Auth0 (@auth0/auth0-react 2.3.0)
* プラットフォーム: PC
* レポジトリ: school-timetable-frontend

### バックエンド

* フレームワーク: Hono 4.8.3
* ランタイム: Cloudflare Workers
* データベース: Cloudflare D1 (SQLite)
* ORM: Prisma 6.11.0 with @prisma/adapter-d1
* バリデーション: Zod 3.22.3
* デプロイ: Wrangler 4.22.0
* レポジトリ: school-timetable-backend

### 開発・テスト環境

* パッケージマネージャー: pnpm
* テストフレームワーク
  * フロントエンド: jest 30.0.4 + @testing-library/react 16.3.0 + @testing-library/dom 10.4.0
  * バックエンド: vitest 3.2.4
* リンター: @biomejs/biome 2.0.6
* CI/CD: GitHub Actions

## プロジェクト構造

後ほど整理出来次第記載します。
詳細はプロジェクトフォルダを参照してください。

## データベース設計

### モデル構成

製造しながら相談とさせてください。

### 環境別 DB 設定

* 開発: `school-timetable-db`
* ステージング: `school-timetable-db-staging`
* 本番: `school-timetable-db-prod`

## 開発ワークフロー

### セットアップ

```bash
# 1. フロントエンドセットアップ
## フロントエンドのプロジェクトで実行
pnpm install

# 2. バックエンドセットアップ
## バックエンドのプロジェクトで実行
pnpm install

# 3. 環境変数設定（Auth0設定が必要）
cp .env.example .env
```

### 開発サーバー起動

```bash
# フロントエンド（フロントエンドのプロジェクトから）
pnpm dev               # 開発サーバー

# バックエンド（バックエンドのプロジェクトから）
pnpm dev               # Wrangler開発サーバー（ローカル）
```

### テスト実行

```bash
# フロントエンド
## 何も構成できていません

# バックエンド
cd backend
## 何も構成できていません
```

### コード品質チェック

```bash
# リンティング
## Biomeの設定ができていません。

# 型チェック
## Biomeの設定ができていません。
```

### データベース操作

```bash
## バックエンドのプロジェクトから

## DB構築ができていません。
```

## 認証システム

### Auth0 設定

* プロバイダー: Auth0
* セッション管理: localStorage（Web）

## テストガイドライン

### フロントエンドのテスト

* テスト対象: ユーティリティ関数、カスタムフック、純粋関数
* 環境: Jest + React Testing Library
* 日本語: テスト説明とコメントは日本語で記述

### バックエンドのテスト

* テスト対象: API エンドポイント、データベース操作、ビジネスロジック
* 環境: Hono + vitest

### テスト実行環境

まだ構築できていません。

## デプロイメント

### フロントエンドのデプロイ

まだ構築できていません。
最終的にはGitHub Actionsでデプロイできるように設定したいと思います。

### バックエンドのデプロイ

まだ構築できていません。
最終的にはGitHub Actionsでデプロイできるように設定したいと思います。

## 重要な設定ファイル

### フロントエンドの設定ファイル

* `tsconfig.json`: TypeScript 設定

### バックエンドの設定ファイル

* `wrangler.toml`: Cloudflare Workers 設定
* `prisma/schema.prisma`: データベーススキーマ
* `vitest.config.ts`: テスト設定

## トラブルシューティング

### よくある問題

1. 認証エラー: Auth0 のコールバック URL 設定を確認
2. 型エラー: Prisma クライアント生成（pnpm db:generate）を実行
3. D1 エラー: wrangler.toml の database_id 設定を確認

## CI/CD

GitHub Actions で以下を自動実行：

* TypeScript 型チェック
* Biome リンティング
* Vitest ユニットテスト
* ビルド検証
実行タイミング：

* main/developブランチへのプッシュ
* main/developブランチへのプルリクエスト

## コントリビューション

1. 機能ブランチを作成
2. コード品質チェックを通す（lint + type-check + test）
3. 日本語でのコメント・テスト記述
4. プルリクエスト作成

## コード生成規約

* 言語: TypeScript

### コメント

* 各ファイルの冒頭には日本語のコメントで仕様を記述する。

出力例

```Typescript
/**
 * 2点間のユークリッド距離を計算する
 **/
type Point = { x: number; y: number };
export function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
```

### テスト

* 各機能に対しては必ずユニットテストを実装
* コードを追加で修正したとき、`pnpm run test` がパスすることを常に確認する。

```Typescript
function add(a: number, b: number) {
  return a + b;
}
test("1+2=3", () => {
  expect(add(1, 2)).toBe(3);
});
```

* vitest で実装と同じファイルにユニットテストを書く。

出力例

```Typescript
export function distance(a: Point, b: Point): number {...}
if (import.meta.vitest) {
  const {test, expect} = import.meta.vitest;
  test("ユークリッド距離を計算する", () => {
    const result = distance({x: 0, y: 0}, {x: 3, y: 4});
    expect(distance(result)).toBe(5)
  });
}
```

* コードスタイル: Biome で統一
* ドキュメント: 関数やコンポーネントには JSDoc コメントを必ず追加
* 規約: ハードコードは絶対にしないでください。環境変数や設定ファイルを使用して、柔軟に対応できるようにします。

## 参考リンク

* [React](https://ja.react.dev/reference/react)
* [Next.js](https://nextjs.org/docs)
* [Hono Documentation](https://hono.dev/docs/)
* [Cloudflare Workers](https://developers.cloudflare.com/workers/)
* [Prisma Documentation](https://www.prisma.io/docs)
* [Auth0 Documentation](https://auth0.com/docs)
