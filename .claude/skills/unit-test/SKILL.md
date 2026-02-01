---
name: unit-test
description: Run unit tests for backend and frontend directories
disable-model-invocation: true
---

# Unit Test Runner

Backend と Frontend の単体テストを実行し、結果を分析します。

## 実行ステップ

### 1. Backend テスト実行

Backend ディレクトリに移動して、Vitest を使用したテスト実行：

```bash
cd backend && npm test
```

**期待される動作**：
- すべてのテストファイル（`*.test.ts`）が実行される
- テスト結果サマリーが表示される
- 失敗があれば詳細なエラーメッセージが表示される

### 2. Frontend テスト実行

Frontend ディレクトリに移動して、Vitest + React Testing Library によるテスト実行：

```bash
cd frontend && npm test
```

**期待される動作**：
- すべてのテストファイル（`*.test.ts`, `*.test.tsx`）が実行される
- React コンポーネントのテスト結果が表示される
- 失敗があれば詳細なエラーメッセージが表示される

### 3. 結果分析とレポート

テスト実行後、以下の情報をまとめてレポートしてください：

**サマリー情報**：
- Backend: 合計テスト数、成功数、失敗数
- Frontend: 合計テスト数、成功数、失敗数
- 全体の成功率

**失敗テストの詳細分析**（失敗がある場合）：
- テストファイル名と場所
- 失敗したテスト名
- Expected vs Actual の結果
- スタックトレース
- 推奨される修正方針

**その他**：
- テスト実行に要した時間
- 警告メッセージ（存在する場合）

## 使用技術

| 項目 | Backend | Frontend |
|-----|---------|----------|
| テストフレームワーク | Vitest 3.0.0 | Vitest 3.0.0 + React Testing Library |
| コマンド | npm test | npm test |
| 設定ファイル | vitest.config.ts | vitest.config.ts |

## トラブルシューティング

- **node_modules がない場合**: `npm install` を先に実行してください
- **TypeScript エラー**: 各ディレクトリで `npm run build` を実行し、型チェックしてください
- **テスト失敗が続く場合**: ソースコード `src/` ディレクトリを確認し、修正が必要かどうか判断してください
