---
name: unit-test
description: Run unit tests for backend and frontend directories
---

# Unit Test Runner

Backend と Frontend の単体テストを実行し、詳細に分析するスキルです。

このスキルは、`unit-test-runner` サブエージェントを呼び出して、以下の処理を実行します：

## 処理内容

### 1. Backend テスト実行

- Backend ディレクトリの Vitest テストを実行
- 全テストファイルを自動実行
- テスト結果をキャプチャ

### 2. Frontend テスト実行

- Frontend ディレクトリの Vitest + React Testing Library テストを実行
- 全テストファイルを自動実行
- テスト結果をキャプチャ

### 3. 詳細レポート生成

- Backend/Frontend の成功/失敗を分析
- 失敗テストの根本原因を特定
- 修正提案を提供

## 使用方法

### 基本的な実行

```
/unit-test
```

このコマンドを実行すると、`unit-test-runner` サブエージェントが起動し、以下の処理を自動実行します：

1. Backend のテスト実行
2. Frontend のテスト実行
3. 結果の分析
4. 詳細レポートの生成

### テスト修正が必要な場合

失敗したテストに対して、以下のように指示してください：

```
/unit-test で実行して、失敗したテストを修正してください
```

サブエージェントが自動的に以下を実行します：

1. ソースコードを読取
2. 問題の原因を特定
3. コードを修正
4. テストを再実行して確認

## 使用技術

| 項目                 | Backend          | Frontend                             |
| -------------------- | ---------------- | ------------------------------------ |
| テストフレームワーク | Vitest 3.0.0     | Vitest 3.0.0 + React Testing Library |
| コマンド             | npm test         | npm test                             |
| 設定ファイル         | vitest.config.ts | vitest.config.ts                     |

## 詳細なエージェント仕様

テストの実行・分析・修正の詳細は、`.claude/agents/unit-test-runner/` で定義されています。
