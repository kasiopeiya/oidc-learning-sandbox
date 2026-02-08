# `/ci` スラッシュコマンド実装計画

## Context（背景と目的）

### なぜこの変更が必要か

現在、コミット前やPR作成前にコード品質をチェックする統合的なコマンドがありません。開発者は以下を個別に実行する必要があります：

- `npm run format:check` （Prettier チェック）
- `npm run lint` （ESLint - 未設定）
- `npm run type-check` （型チェック - スクリプトなし）
- `npm test` （単体テスト）

これは非効率で、チェック漏れのリスクもあります。

### 解決したい問題

1. **ESLint が未設定**: Backend に `lint` スクリプトはあるが、ESLint パッケージがインストールされていない
2. **型チェックスクリプトがない**: TypeScript の型チェックを実行する統一的な方法がない
3. **統合 CI コマンドがない**: 静的解析とテストを一括実行できない

### 期待される成果

- `/ci` コマンド一つで、全ての品質チェック（静的解析 + テスト）を実行
- コミット前/PR前の品質担保を自動化
- エラー時は詳細な修正提案を表示
- 既存の開発フローに統合（CLAUDE.md の開発フロー Step 6.1, 6.2 の `/ci` 部分）

---

## 実装方針

### 採用技術

#### ESLint 9.x + Flat Config 形式（最新）

**選定理由**:

- プロジェクトに ESLint が未導入のため、最新バージョンを採用
- ESLint 9.x では `.eslintrc.js` が非推奨、`eslint.config.mjs` (Flat Config) が標準
- 参考: [ESLint 9 Flat config tutorial](https://dev.to/aolyang/eslint-9-flat-config-tutorial-2bm5), [How to Set Up ESLint 9 with Prettier in Node.js](https://medium.com/@madhan.gannarapu/how-to-set-up-eslint-9-with-prettier-in-node-js-flat-config-typescript-0eb1755f83cd)

**必要なパッケージ**:

- Backend: `eslint`, `@eslint/js`, `typescript-eslint`, `globals`
- Frontend: `eslint`, `@eslint/js`, `typescript-eslint`, `globals`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`

### 実行順序（早期失敗戦略）

各チェックを順次実行し、**最初の失敗で即座に停止**:

1. **Prettier チェック** → フォーマット違反があると後続のレビューが困難
2. **ESLint チェック** → 構文エラー・コーディングスタイル違反
3. **TypeScript 型チェック** → 型安全性の検証
4. **単体テスト実行** → 機能検証

**設計判断**: 並列実行ではなく逐次実行を採用

- 理由: 最初の失敗で停止することで、開発者は基本的な問題から段階的に修正できる
- 例: フォーマットエラーを修正してから型エラーに取り組む方が効率的

---

## 実装内容

### Phase 1: ESLint 設定の追加

#### 1.1 Backend の ESLint 設定

**作成するファイル**: [`backend/eslint.config.mjs`](backend/eslint.config.mjs)

```javascript
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  {
    ignores: ['dist', 'node_modules', '*.config.ts', '*.config.mjs', '**/*.test.ts']
  }
)
```

**設計のポイント**:

- `recommendedTypeChecked`: 型情報を活用した厳格なチェック
- `no-explicit-any` は警告レベル: 段階的な改善を許容
- テストファイルは除外: テストコードは柔軟性を優先

**追加する依存関係**: [`backend/package.json`](backend/package.json)

```json
{
  "devDependencies": {
    "eslint": "^9.17.0",
    "@eslint/js": "^9.17.0",
    "typescript-eslint": "^8.19.1",
    "globals": "^15.14.0"
  }
}
```

**追加するスクリプト**: [`backend/package.json`](backend/package.json)

```json
{
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```

注: `lint`, `lint:fix` スクリプトは既に存在するため、変更不要

#### 1.2 Frontend の ESLint 設定

**作成するファイル**: [`frontend/eslint.config.mjs`](frontend/eslint.config.mjs)

```javascript
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  jsxA11y.flatConfigs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2020
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    ignores: [
      'dist',
      'node_modules',
      '*.config.ts',
      '*.config.mjs',
      '**/*.test.ts',
      '**/*.test.tsx'
    ]
  }
)
```

**設計のポイント**:

- React 18.3+ 対応: `jsx-runtime` config で `import React` 不要
- アクセシビリティ: `jsx-a11y` プラグインで a11y チェック
- React Hooks ルール: `rules-of-hooks`, `exhaustive-deps` を有効化

**追加する依存関係**: [`frontend/package.json`](frontend/package.json)

```json
{
  "devDependencies": {
    "eslint": "^9.17.0",
    "@eslint/js": "^9.17.0",
    "typescript-eslint": "^8.19.1",
    "globals": "^15.14.0",
    "eslint-plugin-react": "^7.37.3",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-jsx-a11y": "^6.10.2"
  }
}
```

**追加するスクリプト**: [`frontend/package.json`](frontend/package.json)

```json
{
  "scripts": {
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit"
  }
}
```

### Phase 2: `/ci` スキルとエージェントの実装

#### 2.1 スキル定義ファイル

**作成するファイル**: [`.claude/skills/ci/SKILL.md`](.claude/skills/ci/SKILL.md)

```markdown
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

| スキル | スコープ | 用途 |
|--------|---------|------|
| `/unit-test` | テスト実行のみ | 開発中の単体テスト実行 |
| `/tdd` | テスト駆動開発（特定ファイル） | Issue ベースの機能実装 |
| `/ci` (新規) | 静的解析 + テスト（全体） | コミット前/PR 前の品質チェック |

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
```

#### 2.2 エージェント定義ファイル

**作成するファイル**: [`.claude/agents/ci-runner/ci-runner.md`](.claude/agents/ci-runner/ci-runner.md)

````markdown
---
name: ci-runner
description: Run static analysis and unit tests for backend and frontend, analyze failures, and provide detailed reports
tools: Read, Bash, Grep, Glob
model: sonnet
---

# CI Runner Agent

Backend と Frontend の静的解析と単体テストを実行し、詳細に分析・レポートする専門エージェント。

## 実行プロセス

### Phase 1: 環境チェック

以下を確認し、エラーがある場合は処理を中止:

```bash
ls -d /Users/yutohasegawa/dev/oidc-learning-sandbox/backend/node_modules
ls -d /Users/yutohasegawa/dev/oidc-learning-sandbox/frontend/node_modules
```
````

**エラー時の出力**:

```
🔴 環境エラー

Error: node_modules が見つかりません

以下のコマンドで依存関係をインストールしてください:
cd backend && npm install
cd frontend && npm install
```

### Phase 2: Prettier チェック

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox && npm run format:check
```

**成功判定**: 終了コード 0

**失敗時の処理**:

```
🔴 CI Failed: Prettier Check

フォーマット違反が検出されました:
- backend/src/handlers/login.ts
- frontend/src/pages/HomePage.tsx

修正方法:
npm run format

CIチェックを中断します。
```

→ 処理終了

### Phase 3: ESLint チェック（Backend）

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/backend && npm run lint
```

**成功判定**: 終了コード 0

**失敗時の処理**:

```
🔴 CI Failed: ESLint (Backend)

以下のファイルでエラーが検出されました:

backend/src/handlers/login.ts:15:7
  Error: 'unusedVar' is assigned a value but never used
  Rule: @typescript-eslint/no-unused-vars

修正方法:
1. 未使用変数を削除
2. 自動修正を試す: cd backend && npm run lint:fix

CIチェックを中断します。
```

→ 処理終了

### Phase 4: ESLint チェック（Frontend）

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/frontend && npm run lint
```

**成功判定**: 終了コード 0

**失敗時の処理**: Backend と同様の形式

### Phase 5: TypeScript 型チェック（Backend）

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/backend && npm run type-check
```

**成功判定**: 終了コード 0

**失敗時の処理**:

```
🔴 CI Failed: TypeScript Type Check (Backend)

以下のファイルで型エラーが検出されました:

backend/src/handlers/login.ts:42:7
  Error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.

修正方法:
processId 関数の引数型を確認し、正しい型に変換してください。

CIチェックを中断します。
```

→ 処理終了

### Phase 6: TypeScript 型チェック（Frontend）

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/frontend && npm run type-check
```

**成功判定**: 終了コード 0

**失敗時の処理**: Backend と同様の形式

### Phase 7: 単体テスト実行（Backend）

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/backend && npm test
```

**成功判定**: 終了コード 0

**失敗時の処理**:

```
🔴 CI Failed: Unit Tests (Backend)

以下のテストが失敗しました:

backend/src/handlers/login.test.ts
  Test: should return 200 on successful login

  Expected: 200
  Received: 500

  at src/handlers/login.test.ts:27:33

修正方法:
1. テスト対象コード（login.ts）のロジックを確認
2. 500 エラーの原因を特定
3. 修正後、再度テストを実行

CIチェックを中断します。
```

→ 処理終了

### Phase 8: 単体テスト実行（Frontend）

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/frontend && npm test
```

**成功判定**: 終了コード 0

**失敗時の処理**: Backend と同様の形式

### Phase 9: 成功レポート生成

全てのチェックが成功した場合:

```
✅ CI Passed!

All checks completed successfully.

=== Summary ===

Prettier Check:        ✅ Passed
ESLint (Backend):      ✅ Passed
ESLint (Frontend):     ✅ Passed
Type Check (Backend):  ✅ Passed
Type Check (Frontend): ✅ Passed
Unit Tests (Backend):  ✅ Passed (X tests)
Unit Tests (Frontend): ✅ Passed (Y tests)

Total Tests: X + Y tests passed

=== Next Steps ===

1. git add . && git commit でコミット作成
2. git push でリモートにプッシュ
3. PR を作成してコードレビューを依頼

CIチェック完了！
```

## 実装上の注意点

### エラー出力の解析

各コマンドの stderr/stdout を解析し、以下を抽出:

- ファイルパス
- 行番号:列番号
- エラーメッセージ
- ルール名（ESLint の場合）
- エラーコード（TypeScript の場合）

### 終了コードの判定

- 終了コード 0: 成功 → 次のチェックに進む
- 終了コード 0 以外: 失敗 → レポート生成して処理終了

### Bash ツールの使用

- 各チェックは独立した Bash コマンド実行
- timeout 設定: 各コマンド最大 120 秒（テストが長時間かかる可能性）

## 使用可能なツール

- **Bash**: CI コマンドの実行
- **Read**: エラーログの詳細読み込み（必要に応じて）
- **Grep**: エラーメッセージの検索・分析（必要に応じて）
- **Glob**: ファイル検出（必要に応じて）

````

---

## Critical Files（重要なファイル）

実装時に作成・修正するファイル:

### 新規作成

1. [`backend/eslint.config.mjs`](backend/eslint.config.mjs) - Backend の ESLint 設定（Flat Config 形式）
2. [`frontend/eslint.config.mjs`](frontend/eslint.config.mjs) - Frontend の ESLint 設定（Flat Config 形式）
3. [`.claude/skills/ci/SKILL.md`](.claude/skills/ci/SKILL.md) - CI スキルの定義
4. [`.claude/agents/ci-runner/ci-runner.md`](.claude/agents/ci-runner/ci-runner.md) - CI Runner エージェントの定義

### 修正

5. [`backend/package.json`](backend/package.json) - ESLint 依存関係と `type-check` スクリプト追加
6. [`frontend/package.json`](frontend/package.json) - ESLint 依存関係と `lint`, `lint:fix`, `type-check` スクリプト追加

---

## 実装の優先順位

### Step 1: ESLint 設定とスクリプトの追加

1. `backend/eslint.config.mjs` を作成
2. `backend/package.json` に依存関係とスクリプトを追加
3. `cd backend && npm install` を実行
4. `cd backend && npm run lint` で動作確認

5. `frontend/eslint.config.mjs` を作成
6. `frontend/package.json` に依存関係とスクリプトを追加
7. `cd frontend && npm install` を実行
8. `cd frontend && npm run lint` で動作確認

**重要**: この時点で既存コードに多数の ESLint エラーが検出される可能性があります。
- 自動修正可能なエラーは `npm run lint:fix` で修正
- 自動修正できないエラーは手動修正
- エラーが多い場合は、ルールを一時的に警告レベルに緩和することも検討

### Step 2: `/ci` スキルとエージェントの実装

1. `.claude/skills/ci/SKILL.md` を作成
2. `.claude/agents/ci-runner/ci-runner.md` を作成
3. `/ci` コマンドを実行して動作確認

### Step 3: 動作確認

#### テストケース 1: 全チェック成功

```bash
/ci
````

**期待結果**: `✅ CI Passed!` と表示

#### テストケース 2: Prettier チェック失敗

```bash
# backend/src/handlers/login.ts の末尾にスペースを追加
/ci
```

**期待結果**: Prettier チェックで失敗、修正方法が提案される

#### テストケース 3: ESLint チェック失敗

```bash
# backend/src/handlers/login.ts に未使用変数を追加
/ci
```

**期待結果**: ESLint (Backend) チェックで失敗、ルール名と修正方法が表示

#### テストケース 4: TypeScript 型チェック失敗

```bash
# backend/src/handlers/login.ts に型エラーを追加
/ci
```

**期待結果**: Type Check (Backend) で失敗、型エラー箇所と原因が表示

#### テストケース 5: 単体テスト失敗

```bash
# backend/src/handlers/login.test.ts の期待値を変更
/ci
```

**期待結果**: Unit Tests (Backend) で失敗、失敗したテスト名とエラー内容が表示

---

## 検証方法

### 1. 各コマンドの個別実行

```bash
# Prettier チェック
npm run format:check

# ESLint チェック（Backend）
cd backend && npm run lint

# ESLint チェック（Frontend）
cd frontend && npm run lint

# TypeScript 型チェック（Backend）
cd backend && npm run type-check

# TypeScript 型チェック（Frontend）
cd frontend && npm run type-check

# 単体テスト（Backend）
cd backend && npm test

# 単体テスト（Frontend）
cd frontend && npm test
```

### 2. `/ci` コマンドの実行

```bash
/ci
```

### 3. エラーケースの確認

意図的にエラーを混入して、適切なエラーメッセージが表示されることを確認

---

## 将来的な拡張案（今回は実装しない）

1. **カバレッジレポート**: テストカバレッジの閾値チェック
2. **並列実行オプション**: `--parallel` フラグで並列実行を有効化
3. **キャッシュ機能**: 前回実行結果をキャッシュして高速化
4. **修正の自動提案**: AI による修正コードの生成

---

## 参考情報

- [ESLint 9 Flat config tutorial](https://dev.to/aolyang/eslint-9-flat-config-tutorial-2bm5)
- [How to Set Up ESLint 9 with Prettier in Node.js](https://medium.com/@madhan.gannarapu/how-to-set-up-eslint-9-with-prettier-in-node-js-flat-config-typescript-0eb1755f83cd)
- [Modern Linting in 2025: ESLint Flat Config with TypeScript and JavaScript](https://advancedfrontends.com/eslint-flat-config-typescript-javascript/)
- [Getting Started | typescript-eslint](https://typescript-eslint.io/getting-started/)
- [Configuration Files - ESLint](https://eslint.org/docs/latest/use/configure/configuration-files)
