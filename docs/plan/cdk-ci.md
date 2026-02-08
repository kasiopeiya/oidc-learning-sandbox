# /cdk-ci スラッシュコマンド実装計画

## Context（背景と目的）

本プロジェクトは仕様駆動開発を採用しており、Backend/Frontend向けに `/ci` コマンドで静的解析・単体テストを実行できるようになっています。

しかし、CDKインフラストラクチャコードには専用のCI検証コマンドが存在せず、以下の課題がありました：

- CDKコードの品質チェックが手動
- CloudFormationテンプレート生成（`cdk synth`）の検証が未自動化
- Backend/Frontendと統一されたCI/CD体験がない

CLAUDE.mdには以下の開発フローが定義されていますが、`/cdk-ci`コマンドが未実装でした：

> 6.2 CDK実装の場合 - /cdk-devで実装　＊CDKはテスト駆動開発できないので/tddではなくこちらを使用 - /cdk-reviewでコードレビュー - /cdk-ciで静的解析・snapshotテスト・cdk synth

**本プランの目的:**
CDK専用の `/cdk-ci` コマンドを実装し、Backend/Frontendと同等の品質チェック体験を提供する。

---

## 実装アプローチ

### 1. 全体構成

既存の `/ci` コマンド（Backend/Frontend向け）の実装パターンを踏襲し、CDK向けにカスタマイズします。

**実装する構成:**

```
.claude/
├── skills/cdk-ci/SKILL.md          # スキル定義（エントリーポイント）
└── agents/cdk-ci-runner/
    └── cdk-ci-runner.md             # CI実行エージェント

cdk/
├── eslint.config.mjs                # ESLint設定（新規作成）
└── package.json                     # スクリプト追加
```

### 2. 実行フロー（7 Phase構成）

既存 `/ci` の **早期フェイル** 原則を踏襲し、最初の失敗で即座に停止します。

| Phase | 実行内容         | コマンド                 | ディレクトリ |
| ----- | ---------------- | ------------------------ | ------------ |
| 1     | 環境チェック     | `ls -d cdk/node_modules` | ルート       |
| 2     | Prettierチェック | `npm run format:check`   | ルート       |
| 3     | ESLint静的解析   | `npm run lint`           | cdk/         |
| 4     | TypeScriptビルド | `npm run build`          | cdk/         |
| 5     | Snapshotテスト   | `npm test`               | cdk/         |
| 6     | cdk synth        | `npx cdk synth`          | cdk/         |
| 7     | 成功レポート     | -                        | -            |

**Backend/Frontendとの差分:**

- Phase 3-5: Backend/Frontendは2回ずつ実行するが、CDKは1回のみ
- Phase 4: `tsc --noEmit` の代わりに `npm run build`（CDKはビルド必須）
- Phase 6: `cdk synth` を追加（CloudFormationテンプレート生成検証）

### 3. ファイル別実装詳細

#### 3-1. cdk/package.json（スクリプト追加）

**現状:** `lint`, `lint:fix`, `type-check` スクリプトが存在しない

**追加するスクリプト:**

```json
{
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "test": "vitest run",
    "test:watch": "vitest",
    "cdk": "cdk",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "type-check": "tsc --noEmit"
  }
}
```

**追加するdevDependencies:**

```json
{
  "devDependencies": {
    "@types/node": "^22.0.0",
    "vitest": "^2.0.0",
    "aws-cdk": "2.1101.0",
    "ts-node": "^10.9.2",
    "typescript": "~5.7.0",
    "@eslint/js": "^9.17.0",
    "eslint": "^9.17.0",
    "globals": "^15.14.0",
    "typescript-eslint": "^8.19.1"
  }
}
```

#### 3-2. cdk/eslint.config.mjs（新規作成）

**参考実装:** [backend/eslint.config.mjs](backend/eslint.config.mjs:1-30)

**CDK向けカスタマイズ:**

- Reactプラグイン不要（Node.js環境）
- `target: ES2020`（[cdk/tsconfig.json](cdk/tsconfig.json:3) に合わせる）
- `ignores`: `cdk.out/` を追加（CDKの出力ディレクトリ）

```javascript
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2020
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
    ignores: ['cdk.out', 'node_modules', '*.config.ts', '*.config.mjs', '**/*.test.ts', '*.js']
  }
)
```

#### 3-3. .claude/skills/cdk-ci/SKILL.md（新規作成）

**参考実装:** [.claude/skills/ci/SKILL.md](/.claude/skills/ci/SKILL.md:1-118)

**CDK向けカスタマイズポイント:**

- スコープ: Backend/Frontend → CDKのみ
- Phase 6に `cdk synth` を追加
- サブエージェント名: `ci-runner` → `cdk-ci-runner`

**スキルの役割:**

1. `cdk-ci-runner` サブエージェントを起動
2. エージェントの出力をそのまま全文表示（要約・加工禁止）

#### 3-4. .claude/agents/cdk-ci-runner/cdk-ci-runner.md（新規作成）

**参考実装:** [.claude/agents/ci-runner/ci-runner.md](/.claude/agents/ci-runner/ci-runner.md:1-235)

**CDK向けカスタマイズポイント:**

**Phase 1: 環境チェック**

```bash
ls -d /Users/yutohasegawa/dev/oidc-learning-sandbox/cdk/node_modules
```

（Backend/Frontendの2回チェック → CDKの1回のみ）

**Phase 2: Prettier**

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox && npm run format:check
```

（既存と同じ）

**Phase 3: ESLint（CDK）**

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/cdk && npm run lint
```

（Backend/Frontend 2回 → CDK 1回）

**Phase 4: TypeScriptビルド（CDK）**

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/cdk && npm run build
```

（`tsc --noEmit` → `tsc` でビルド実行）

**Phase 5: Snapshotテスト（CDK）**

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/cdk && npm test
```

（単体テスト → Snapshotテスト）

**Phase 6: cdk synth（新規追加）**

```bash
cd /Users/yutohasegawa/dev/oidc-learning-sandbox/cdk && npx cdk synth
```

（CDK専用フェーズ：CloudFormationテンプレート生成検証）

**Phase 7: 成功レポート**

```
✅ CDK CI Passed!

=== Summary ===
Prettier Check:      ✅ Passed
ESLint (CDK):        ✅ Passed
TypeScript Build:    ✅ Passed
Snapshot Tests:      ✅ Passed (X tests)
cdk synth:           ✅ Passed
```

**エラーハンドリング:**

- 各Phaseの終了コードが0以外の場合、詳細なエラーレポートを生成して即座に処理終了
- エラー出力からファイルパス・行番号・エラーメッセージを抽出
- 修正方法を提案

---

## Critical Files（変更するファイル）

### 新規作成

1. [.claude/skills/cdk-ci/SKILL.md](/.claude/skills/cdk-ci/SKILL.md)
   - スキル定義
   - cdk-ci-runnerエージェント起動ロジック

2. [.claude/agents/cdk-ci-runner/cdk-ci-runner.md](/.claude/agents/cdk-ci-runner/cdk-ci-runner.md)
   - 7 Phase の CI実行フロー定義
   - エラーハンドリングとレポート生成

3. [cdk/eslint.config.mjs](cdk/eslint.config.mjs)
   - ESLint設定（Backend参考、React不要）

### 既存ファイル編集

4. [cdk/package.json](cdk/package.json:1-26)
   - `lint`, `lint:fix`, `type-check` スクリプト追加
   - ESLint関連のdevDependencies追加

---

## 既存機能の再利用

以下の既存実装パターンを再利用します：

1. **スキル構成:** [.claude/skills/ci/SKILL.md](/.claude/skills/ci/SKILL.md:1-118)
   - エージェント起動パターン
   - 出力表示ルール（全文そのまま表示）

2. **エージェント構成:** [.claude/agents/ci-runner/ci-runner.md](/.claude/agents/ci-runner/ci-runner.md:1-235)
   - Phase別実行フロー
   - 早期フェイル機構
   - エラーレポート生成

3. **ESLint設定:** [backend/eslint.config.mjs](backend/eslint.config.mjs:1-30)
   - TypeScript ESLint設定
   - Reactプラグインを除外してCDK向けにカスタマイズ

---

## 実装手順

### Step 1: 依存関係インストール

```bash
cd cdk
npm install --save-dev @eslint/js eslint globals typescript-eslint
```

### Step 2: package.jsonスクリプト追加

既存の [cdk/package.json](cdk/package.json:7-12) に `lint`, `lint:fix`, `type-check` を追加

### Step 3: ESLint設定作成

`cdk/eslint.config.mjs` を作成（上記コード参照）

### Step 4: 動作確認（手動）

```bash
cd cdk
npm run lint          # ESLintチェック
npm run type-check    # 型チェック
npm run build         # ビルド
npm test              # テスト
npx cdk synth         # synth実行
```

### Step 5: スキル・エージェント定義作成

- `.claude/skills/cdk-ci/SKILL.md` を作成
- `.claude/agents/cdk-ci-runner/cdk-ci-runner.md` を作成

### Step 6: 統合テスト

```bash
/cdk-ci
```

を実行し、全Phaseが正しく動作することを確認

---

## Verification（検証方法）

### 1. 正常系テスト

```bash
/cdk-ci
```

**期待結果:**
全チェックが成功し、以下のサマリーが表示される：

```
✅ CDK CI Passed!

=== Summary ===
Prettier Check:      ✅ Passed
ESLint (CDK):        ✅ Passed
TypeScript Build:    ✅ Passed
Snapshot Tests:      ✅ Passed
cdk synth:           ✅ Passed
```

### 2. 異常系テスト（各Phaseで意図的にエラー発生）

#### Phase 2失敗: Prettierエラー

CDKファイルのフォーマットを崩して実行：

```bash
/cdk-ci
```

**期待結果:**
Phase 2で停止し、フォーマット違反ファイルのリストが表示される

#### Phase 3失敗: ESLintエラー

未使用変数を追加して実行：

```typescript
// cdk/lib/oidc-sandbox-stack.ts
const unusedVar = 'test' // 未使用変数
```

**期待結果:**
Phase 3で停止し、ESLintエラー（ファイル名:行番号）が表示される

#### Phase 4失敗: TypeScriptビルドエラー

型エラーを追加して実行：

```typescript
const num: number = 'string' // 型エラー
```

**期待結果:**
Phase 4で停止し、コンパイルエラーが表示される

#### Phase 5失敗: Snapshotテスト失敗

[cdk/test/cdk.test.ts](cdk/test/cdk.test.ts) の期待値を変更して実行

**期待結果:**
Phase 5で停止し、テスト失敗詳細が表示される

#### Phase 6失敗: cdk synth失敗

CDKスタック定義に構文エラーを追加して実行

**期待結果:**
Phase 6で停止し、synthエラーが表示される

### 3. 既存 /ci との統合確認

```bash
/ci        # Backend/Frontend
/cdk-ci    # CDK
```

**期待結果:**
両コマンドが独立して動作し、それぞれのスコープのみをチェックする

---

## 追加考慮事項

### cdk synthの依存関係

`cdk synth` はAWS認証情報に依存する可能性があります。CIモードで実行する場合、以下のいずれかの対応を検討：

1. モック環境変数を設定
2. AWS_PROFILEを設定
3. CDK_DEFAULT_ACCOUNT / CDK_DEFAULT_REGION を設定

本実装では、既存の開発環境設定をそのまま利用する前提とします。

### テストの拡充（将来的な改善）

現在のSnapshotテストは最小限です。将来的に以下を追加推奨：

- リソース存在チェック（S3、Lambda、Cognito）
- IAMポリシー検証
- タグ付けルール検証

---

## まとめ

本プランでは、既存の `/ci` コマンドのパターンを踏襲し、CDK専用の `/cdk-ci` コマンドを実装します。

**主な変更点:**

- CDK用ESLint設定追加
- package.jsonスクリプト追加
- cdk-ci-runnerエージェント作成（7 Phase構成）
- cdk synth検証フェーズ追加

**実装後の効果:**

- CDKコードの品質チェック自動化
- Backend/Frontendと統一されたCI体験
- コミット前の品質担保（CLAUDE.mdの開発フロー完成）
