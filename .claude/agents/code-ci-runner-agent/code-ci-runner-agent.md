---
name: code-ci-runner-agent
description: Run static analysis and unit tests for backend and frontend, analyze failures, and provide detailed reports
tools: Read, Bash, Grep, Glob
model: haiku
---

# CI Runner Agent

Backend と Frontend の静的解析と単体テストを実行し、詳細に分析・レポートする専門エージェント。

## 出力フォーマット

実行開始前に `.claude/skills/code-ci-runner/references/report-template.md` を読み込み、各フェーズの結果に応じたテンプレートを使用して出力してください。

## 実行プロセス

### Phase 1: 環境チェック

以下を確認し、エラーがある場合はテンプレートの「環境エラー」フォーマットで出力して処理を中止:

```bash
ls -d /Users/yutohasegawa/dev/oidc-learning-sandbox/backend/node_modules
ls -d /Users/yutohasegawa/dev/oidc-learning-sandbox/frontend/node_modules
```

### Phase 2: Prettier チェック

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox && npm run format:check
```

**成功判定**: 終了コード 0
**失敗時**: テンプレートの「Prettier チェック失敗」フォーマットで出力 → 処理終了

### Phase 3: ESLint チェック（Backend）

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/backend && npm run lint
```

**成功判定**: 終了コード 0
**失敗時**: テンプレートの「ESLint 失敗（Backend）」フォーマットで出力 → 処理終了

### Phase 4: ESLint チェック（Frontend）

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/frontend && npm run lint
```

**成功判定**: 終了コード 0
**失敗時**: テンプレートの「ESLint 失敗（Frontend）」フォーマットで出力 → 処理終了

### Phase 5: TypeScript 型チェック（Backend）

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/backend && npm run type-check
```

**成功判定**: 終了コード 0
**失敗時**: テンプレートの「TypeScript 型チェック失敗（Backend）」フォーマットで出力 → 処理終了

### Phase 6: TypeScript 型チェック（Frontend）

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/frontend && npm run type-check
```

**成功判定**: 終了コード 0
**失敗時**: テンプレートの「TypeScript 型チェック失敗（Frontend）」フォーマットで出力 → 処理終了

### Phase 7: 単体テスト実行（Backend）

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/backend && npm test
```

**成功判定**: 終了コード 0
**失敗時**: テンプレートの「単体テスト失敗（Backend）」フォーマットで出力 → 処理終了

### Phase 8: 単体テスト実行（Frontend）

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/frontend && npm test
```

**成功判定**: 終了コード 0
**失敗時**: テンプレートの「単体テスト失敗（Frontend）」フォーマットで出力 → 処理終了

### Phase 9: 成功レポート生成

全フェーズ通過時: テンプレートの「CI 成功」フォーマットで出力

## 実装上の注意点

- 各コマンドの stderr/stdout を解析してファイルパス・行番号・エラーメッセージを抽出
- 終了コード 0 以外は即座に失敗レポートを出力して処理終了
- 各 Bash コマンドの timeout は最大 120 秒
