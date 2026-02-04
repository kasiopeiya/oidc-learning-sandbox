---
name: validate-design
description: Validate consistency between design documents and implementation code
---

# Design Validator

設計書（`docs/` 配下）とアプリケーションコード（`backend/`, `frontend/`）の整合性を自動検証するスキルです。

このスキルは、`design-validator-agent` サブエージェントを呼び出して、以下の処理を実行します：

## 処理内容

### 1. 引数解析と検証対象の決定

- 引数を解析し、検証対象（backend/frontend/all）を決定
- 検証対象リストを作成

### 2. 設計書の読み込みと構造化

- `docs/backend-design.md` または `docs/frontend-design.md` を読み込み
- Markdown構造を解析（セクション、テーブル）
- 各検証項目を抽出してリスト化

### 3. 実装コードの探索と読み込み

- Glob tool でファイル一覧を取得
- Read tool で実装ファイルを読み込み
- Grep tool で特定パターン（エラーコード、環境変数など）を検索

### 4. 整合性チェック

Backend検証項目：

- APIエンドポイント定義の一致
- エラーコード定義の一致
- DynamoDBスキーマの一致
- 環境変数の一致

Frontend検証項目：

- 画面/コンポーネント定義の一致
- ルーティング定義の一致
- エラーメッセージマッピングの一致
- 技術スタック（package.json）の一致

### 5. レポート生成

- 不整合箇所のみをリストアップ
- カテゴリごとにグルーピング
- 修正提案を含めて出力

## 使用方法

### 基本的な実行

```
/validate-design
```

このコマンドを実行すると、`design-validator-agent` サブエージェントが起動し、以下の処理を自動実行します：

1. Backend と Frontend の両方の設計書を検証（デフォルト）
2. 設計書から検証項目を抽出
3. 実装コードを読み込んで整合性をチェック
4. 不整合箇所をレポート

### 個別検証

特定の設計書のみを検証する場合：

```
/validate-design backend   # Backend のみ
/validate-design frontend  # Frontend のみ
/validate-design all       # 両方（デフォルトと同じ）
```

### 出力例

#### 整合性がある場合

```
=== Design Validation Report ===

検証対象:
  - Backend: docs/backend-design.md
  - Frontend: docs/frontend-design.md

検証結果: ✅ すべて整合

検証項目:
  ✓ Backend: APIエンドポイント定義 (3/3)
  ✓ Backend: エラーコード定義 (12/12)
  ✓ Backend: DynamoDBスキーマ (6/6)
  ✓ Backend: 環境変数 (5/5)
  ✓ Frontend: 画面/コンポーネント定義 (3/3)
  ✓ Frontend: ルーティング定義 (3/3)
  ✓ Frontend: エラーメッセージマッピング (9/9)
  ✓ Frontend: 技術スタック (4/4)

すべての検証項目で整合性が確認されました。
```

#### 不整合がある場合

```
=== Design Validation Report ===

検証対象:
  - Backend: docs/backend-design.md

検証結果: ⚠️ 不整合を検出

不整合の詳細:

📝 Backend: エラーコード定義

1. 設計書に記載されているが実装に存在しない
   - エラーコード: account_generation_error
   - 設計書: docs/backend-design.md (セクション 3.3)
   - 実装: backend/src/handlers/account.ts に見つかりません
   - 推奨対応: エラーハンドリングを追加するか、設計書から削除

2. 実装に存在するが設計書に記載されていない
   - 環境変数: LOG_LEVEL
   - 実装: backend/src/handlers/login.ts Line 54
   - 設計書: docs/backend-design.md の環境変数一覧に記載なし
   - 推奨対応: 設計書の環境変数一覧に追記

整合性のある項目:
  ✓ Backend: APIエンドポイント定義 (3/3)
  ✓ Backend: DynamoDBスキーマ (6/6)
  ✗ Backend: エラーコード定義 (11/12 - 1件不整合)
  ✗ Backend: 環境変数 (5/6 - 1件警告)
```

## 使用技術

| 項目       | 詳細                                                          |
| ---------- | ------------------------------------------------------------- |
| 検証対象   | docs/backend-design.md, docs/frontend-design.md               |
| 実装ツール | Read (ファイル読込), Glob (ファイル検索), Grep (パターン検索) |
| 解析手法   | Markdown構造解析、正規表現パターンマッチ                      |
| 実装       | design-validator-agent サブエージェント                       |

## 詳細なエージェント仕様

検証ロジック、Markdown解析、不整合検出の詳細は、`.claude/agents/design-validator-agent/` で定義されています。

## 注意事項

- 設計書のセクション番号やテーブル形式が変更されると、検証ロジックの調整が必要になる場合があります
- 静的な定義のみを検証し、動的なロジックの検証は行いません
- 実装の動作正確性は別途ユニットテストで確認してください
