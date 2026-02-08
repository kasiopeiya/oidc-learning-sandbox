---
name: ci
description: Run static analysis and unit tests for backend and frontend (CI pipeline simulation)
---

# CI (Continuous Integration) Command

Backend と Frontend の静的解析と単体テストを実行し、CI/CD パイプラインのローカル実行を可能にするスキルです。

このスキルは、`ci-runner` サブエージェントを呼び出して、以下の処理を実行します。

## 処理内容

### 1. Prettier によるフォーマットチェック

- ルートレベルの Prettier チェック
- フォーマット違反の検出

### 2. ESLint による静的解析

- Backend ディレクトリの ESLint チェック
- Frontend ディレクトリの ESLint チェック
- エラー/警告の集約

### 3. TypeScript 型チェック

- Backend ディレクトリの型チェック (`tsc --noEmit`)
- Frontend ディレクトリの型チェック (`tsc --noEmit`)
- 型エラーの集約

### 4. 単体テスト実行

- Backend ディレクトリの Vitest テスト実行
- Frontend ディレクトリの Vitest テスト実行
- テスト結果の集約

### 5. 詳細レポート生成

- 各チェックの成功/失敗を分析
- 失敗箇所（ファイル名:行番号）の特定
- 原因のサマリーと修正方法の提案

## 使用方法

```
/ci
```

このコマンドを実行すると、`ci-runner` サブエージェントが起動し、以下の処理を自動実行します:

1. Prettier チェック（ルートレベル）
2. ESLint チェック（Backend/Frontend）
3. TypeScript 型チェック（Backend/Frontend）
4. 単体テスト実行（Backend/Frontend）
5. 結果の分析
6. 詳細レポートの生成

## 実行順序

以下の順序で実行され、**最初の失敗で即座に停止**します:

1. Prettier チェック（最も基本的なチェック）
2. ESLint チェック（構文・コーディングスタイル）
3. TypeScript 型チェック（型安全性）
4. 単体テスト実行（機能検証）

## 出力フォーマット

```
## CI Results

### Summary
[サマリーテーブル]

### Failures (該当する場合)
[失敗詳細]

### Next Steps
[修正方法の提案 or 次のアクション]
```

## 既存スキルとの違い

| スキル       | スコープ                       | 用途                           |
| ------------ | ------------------------------ | ------------------------------ |
| `/unit-test` | テスト実行のみ                 | 開発中の単体テスト実行         |
| `/tdd`       | テスト駆動開発（特定ファイル） | Issue ベースの機能実装         |
| `/ci` (新規) | 静的解析 + テスト（全体）      | コミット前/PR 前の品質チェック |

---

## 実行指示（Claude Code への指示）

このスキルが呼び出されたら、以下を**厳格に**実行すること:

### 1. エージェントの起動

Task ツールを使用して `ci-runner` サブエージェントを起動:

```
subagent_type: "ci-runner"
prompt: "Backend と Frontend の静的解析と単体テストを実行してください"
```

### 2. 出力の表示

エージェントが完了したら、**その出力をそのまま全文表示する**こと。

**重要**: 以下の行為は**禁止**:

- エージェントの出力を要約する
- エージェントの出力を加工する
- エージェントの出力にコメントを追加する

**許可される行為**:

- エージェントの出力を全文そのまま表示する
