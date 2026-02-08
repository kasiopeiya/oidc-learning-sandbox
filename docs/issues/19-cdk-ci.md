# Issue #19: /cdk-ci スラッシュコマンド実装計画

### 関連ドキュメント

- 📝 Plan: [cdk-ci.md](../plan/cdk-ci.md)

## 📂 コンテキスト (Context)

> Claudeが調査を開始する起点となるファイルやディレクトリを指定します

- `.claude/skills/cdk-ci/SKILL.md`
- `.claude/agents/cdk-ci-runner/cdk-ci-runner.md`
- `cdk/eslint.config.mjs`
- `cdk/package.json`

### 背景 / 目的

本プロジェクトは仕様駆動開発を採用しており、Backend/Frontend向けに `/ci` コマンドで静的解析・単体テストを実行できるようになっています。

しかし、CDKインフラストラクチャコードには専用のCI検証コマンドが存在せず、以下の課題がありました：

- CDKコードの品質チェックが手動
- CloudFormationテンプレート生成（`cdk synth`）の検証が未自動化
- Backend/Frontendと統一されたCI/CD体験がない

CLAUDE.mdには `/cdk-ci` コマンドによるCDK専用のCI実行フローが定義されていますが、未実装でした。

**本Issueの目的:**
CDK専用の `/cdk-ci` コマンドを実装し、Backend/Frontendと同等の品質チェック体験を提供する。

- ラベル: skill, ci/cd, cdk

### スコープ / 作業項目

#### 全体構成

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

#### 実行フロー（7 Phase構成）

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

#### ファイル別実装詳細

**cdk/package.json（スクリプト追加）:**

- `lint`, `lint:fix`, `type-check` スクリプトを追加
- ESLint関連のdevDependencies追加（`@eslint/js`, `eslint`, `globals`, `typescript-eslint`）

**cdk/eslint.config.mjs（新規作成）:**

- backend/eslint.config.mjsを参考にCDK向けにカスタマイズ
- Reactプラグイン不要（Node.js環境）
- `target: ES2020`（tsconfig.jsonに合わせる）
- `ignores`: `cdk.out/` を追加

**.claude/skills/cdk-ci/SKILL.md（新規作成）:**

- .claude/skills/ci/SKILL.mdを参考
- cdk-ci-runnerサブエージェント起動ロジック
- エージェントの出力をそのまま全文表示

**.claude/agents/cdk-ci-runner/cdk-ci-runner.md（新規作成）:**

- .claude/agents/ci-runner/ci-runner.mdを参考
- 7 Phaseの CI実行フロー定義
- エラーハンドリングとレポート生成

### ゴール / 完了条件（Acceptance Criteria）

- [ ] cdk/eslint.config.mjs を作成し、ESLintが正しく動作することを確認
- [ ] cdk/package.json に lint, lint:fix, type-check スクリプトを追加
- [ ] ESLint関連のdevDependenciesをインストール
- [ ] .claude/skills/cdk-ci/SKILL.md を作成
- [ ] .claude/agents/cdk-ci-runner/cdk-ci-runner.md を作成（7 Phase構成）
- [ ] `/cdk-ci` コマンドで全チェックが順次実行されることを確認
- [ ] 各Phase失敗時に適切なエラーメッセージと修正提案が表示されることを確認
- [ ] 全チェック成功時に成功レポートが表示されることを確認

### テスト観点

#### 正常系テスト

`/cdk-ci` を実行し、全チェックが成功することを確認：

```
✅ CDK CI Passed!

=== Summary ===
Prettier Check:      ✅ Passed
ESLint (CDK):        ✅ Passed
TypeScript Build:    ✅ Passed
Snapshot Tests:      ✅ Passed
cdk synth:           ✅ Passed
```

#### 異常系テスト

各Phaseで意図的にエラーを発生させ、適切なエラーレポートが表示されることを確認：

- **Phase 2失敗**: CDKファイルのフォーマットを崩してPrettierエラー確認
- **Phase 3失敗**: 未使用変数を追加してESLintエラー確認
- **Phase 4失敗**: 型エラーを追加してTypeScriptビルドエラー確認
- **Phase 5失敗**: Snapshotテストの期待値を変更してテスト失敗確認
- **Phase 6失敗**: CDKスタック定義に構文エラーを追加してsynthエラー確認

#### 既存 /ci との統合確認

```bash
/ci        # Backend/Frontend
/cdk-ci    # CDK
```

両コマンドが独立して動作し、それぞれのスコープのみをチェックすることを確認

（必要なら）要確認事項:

- cdk synth実行時のAWS認証情報依存について、開発環境の既存設定で問題ないか確認
