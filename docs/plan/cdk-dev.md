# /cdk-dev コマンド実装プラン

## Context

本プランは、AWS CDK実装専用のカスタムスラッシュコマンド `/cdk-dev` を実装するためのものです。

### 背景

現在のプロジェクトでは、仕様駆動開発フローとして以下のステップが定義されています：

1. アイデア作成（docs/idea）
2. Plan作成（Planモード）
3. Issue作成（/create-issue）
4. 設計書更新（/design）
5. 設計書レビュー（人間）
6. **実装**（ここが本コマンドの対象）
7. 静的解析・テスト（/ci または /cdk-ci）
8. コードレビュー（/review）

Step 6の実装において、アプリケーションコード（backend/frontend）には `/tdd` コマンドが用意されていますが、**CDK実装用のコマンドが存在しません**。

### 課題

- CDKコードはインフラコードであり、TDDの適用が難しい
- `/tdd` コマンドはアプリケーションコード専用のため、CDK実装には適さない
- CDK実装時に特有の確認項目がある：
  - cdk synth による合成テスト
  - 循環参照エラーのチェック
  - CDK特有のルール遵守（import形式、L2 Construct活用など）

### 目的

以下を実現する `/cdk-dev` コマンドを実装します：

1. Issueファイルから実装仕様を抽出
2. 設計書（infrastructure-design.md等）を参照して設計意図を理解
3. CDKコードを実装
4. npm test でテスト実行（スナップショット更新含む）
5. cdk synth で合成テストと循環参照チェック
6. 実装結果をレポート

---

## 実装方針

### アーキテクチャ

既存の `/tdd` および `/ci` コマンドと同様の構造を採用します：

```
.claude/skills/cdk-dev/
└── SKILL.md              # スキル定義ファイル

.claude/agents/cdk-dev-agent/
└── cdk-dev-agent.md      # エージェント実装仕様
```

**役割分担**:

- **SKILL.md**: ユーザーが実行するコマンド定義、エージェント起動、出力表示
- **cdk-dev-agent.md**: 実際の実装ロジック（Phase別の処理フロー）

### `/cdk-dev` と `/cdk-ci` の役割分担

**ユーザーからの回答に基づく設計**:

- `/cdk-dev`: **実装 + cdk synth まで実行**（基本的な動作確認）
- `/cdk-ci`: 静的解析（ESLint, TypeScript型チェック）+ スナップショットテスト + cdk synth

→ `/cdk-dev` は実装直後の即座なフィードバックを提供し、`/cdk-ci` は包括的な品質チェックを実行

### `/tdd` との関係

**完全に独立**:

- CDKはインフラコードなのでTDD適用外
- Lambda関数のビジネスロジックは別途 `/tdd` で実装
- `/cdk-dev` は独自のワークフローで完結

---

## Phase構成

### Phase 1: Issue読み込みと実装仕様の抽出

**目的**: Issueから実装に必要な情報を抽出

**処理ステップ**:

1. **Issue番号またはファイル名の取得**
   - AskUserQuestion でユーザーに入力を促す
   - 引数が渡されている場合はそれを使用

2. **Issueファイルの検出**
   - Glob で `docs/issues/{番号}-*.md` または `docs/issues/*{ファイル名}*.md` を検索
   - 複数マッチした場合は最も番号が近いファイルを選択

3. **Issueファイルの読み込み**
   - Read ツールで全文を読み込み

4. **Issue内容の解析**
   - タイトル（正規表現: `^# Issue #(\d+): (.+)$`）
   - ラベル（正規表現: `- ラベル:\s*(.+)$`）
   - スコープ/作業項目セクション
   - 対象ファイル（📂 コンテキスト セクション）
   - ゴール/完了条件（Acceptance Criteria）
   - テスト観点
   - Planファイルへのリンク（あれば）

5. **Planファイルの読み込み**（オプション）
   - Issue内にリンクがあれば読み込み
   - 詳細な実装方針を取得

6. **実装仕様の整理と確認**
   - 抽出した情報をユーザーに提示
   - AskUserQuestion で開始確認

**エラーハンドリング**:

- Issueファイルが見つからない場合: 利用可能なファイル一覧を表示し再入力を促す（最大3回）
- Issueファイルが空の場合: 処理を中止

---

### Phase 2: 設計書参照と実装方針確認

**目的**: 設計書から設計意図とトレードオフを理解し、実装方針を固める

**処理ステップ**:

1. **ラベルから対象設計書を特定**
   - ラベル `cdk, infra` → `docs/design/infrastructure-design.md`
   - ラベル `backend` → `docs/design/backend-design.md`（Lambda関数関連）
   - ラベル `frontend` → `docs/design/frontend-design.md`（CloudFront/S3関連）

2. **infrastructure-design.md の読み込み**
   - セクション2「設計判断サマリー」（ADRへのリンクと決定内容）
   - セクション3「アーキテクチャ概要」（全体構成図、コンポーネント）
   - セクション6「補足」（スタック構成）

3. **関連設計書の読み込み**（必要に応じて）
   - Lambda関数追加の場合: `backend-design.md`
   - CloudFront/S3変更の場合: `frontend-design.md`

4. **ADRの参照**（必要に応じて）
   - 設計判断サマリーに記載されたADRへのリンクをたどる
   - 例: ADR-001（Lambda Function URLs）、ADR-004（OAC + IAM認証）

5. **CDKルールの確認**
   - `.claude/rules/cdk.md` を読み込み
   - import形式（`aws_s3 as s3` 形式）
   - L2 Construct優先
   - IAM Role自動生成の活用

6. **実装方針の整理と確認**
   - 設計書から抽出した情報を整理
   - AskUserQuestion で実装方針をユーザーに確認

**参考ファイル**:

- `docs/design/infrastructure-design.md`
- `docs/design/backend-design.md`（Lambda関連の場合）
- `docs/design/frontend-design.md`（フロントエンド関連の場合）
- `.claude/rules/cdk.md`

---

### Phase 3: CDK実装

**目的**: 設計書とIssueに基づいてCDKコードを実装

**処理ステップ**:

1. **対象ファイルの特定**
   - Issue内の「📂 コンテキスト」セクションから対象ファイルを取得
   - 通常は `cdk/lib/oidc-sandbox-stack.ts`（メインスタック）
   - 新規Constructの場合は新規ファイル作成も検討

2. **既存CDKコードの読み込み**
   - Read ツールで対象ファイルを読み込み
   - 既存の実装パターンを確認

3. **CDKルールの遵守チェック**
   - Import形式: `import { aws_s3 as s3 } from 'aws-cdk-lib'`
   - Import順序: 標準ライブラリ → サードパーティ → 自作モジュール
   - L2 Construct優先
   - IAM Role自動生成の活用

4. **CDKコードの実装**
   - Edit または Write ツールで実装
   - JSDocコメントで関数の役割・引数・戻り値を明記
   - 日本語コメントで各処理ステップを説明

5. **実装内容の確認**
   - 実装したコードをユーザーに提示
   - AskUserQuestion で確認

**重要な考慮事項**:

- **循環参照の回避**:
  - SSM Parameter Storeの活用（CloudFront URLなど）
  - ワイルドカードリソース指定（Secrets Managerなど）
  - L1 Construct（Cfn）の活用（後付け設定）
- **TypeScriptコンパイルは実施しない**（CLAUDE.mdより）

**参考ファイル**:

- `cdk/lib/oidc-sandbox-stack.ts`（メインスタック）
- `cdk/parameter.ts`（パラメータ定義）
- `.claude/rules/cdk.md`（CDKルール）
- `.claude/rules/typescript.md`（TypeScript共通ルール）

---

### Phase 4: テスト実行

**目的**: 実装したCDKコードの基本的な動作確認

**処理ステップ**:

1. **npm test の実行**

   ```bash
   cd /Users/yutohasegawa/dev/oidc-learning-sandbox/cdk && npm test
   ```

2. **テスト結果の解析**
   - 終了コード 0: 成功
   - 終了コード 非0: 失敗

3. **スナップショット更新の確認**（必要に応じて）
   - テスト失敗がスナップショット不一致の場合、AskUserQuestion でスナップショット更新の可否を確認
   - 承認された場合は以下を実行:
     ```bash
     cd /Users/yutohasegawa/dev/oidc-learning-sandbox/cdk && npm test -- -u
     ```

4. **エラーがあれば修正提案**
   - テストエラーの原因を分析
   - 修正方法を具体的に提案
   - AskUserQuestion で修正するか確認

**エラーハンドリング**:

- テスト失敗時: エラーメッセージを解析し、原因と修正方法を提示
- スナップショット不一致時: ユーザーに更新の可否を確認

---

### Phase 5: CDK合成と循環参照チェック

**目的**: CloudFormationテンプレート合成と循環参照エラーのチェック

**処理ステップ**:

1. **cdk synth の実行**

   ```bash
   cd /Users/yutohasegawa/dev/oidc-learning-sandbox/cdk && npx cdk synth
   ```

2. **合成結果の確認**
   - 終了コード 0: 成功（`cdk.out/` に CloudFormation テンプレート生成）
   - 終了コード 非0: 失敗（エラーメッセージを解析）

3. **循環参照エラーのチェック**
   - エラーメッセージに "Circular dependency" や "Fn::GetAtt" の不正な使用が含まれていないか確認
   - 循環参照エラーが検出された場合:
     - 原因となっているリソース参照を特定
     - 回避方法を提案（SSM Parameter Store、ワイルドカード指定、L1 Construct活用）

4. **エラーがあれば修正提案**
   - 合成エラーの原因を分析
   - 修正方法を具体的に提案
   - AskUserQuestion で修正するか確認

**成功時の出力**:

```
cdk.out/oidc-sandbox-app.template.json - CloudFormation テンプレート
cdk.out/oidc-sandbox-app.assets.json - アセット情報
cdk.out/manifest.json - デプロイメタデータ
cdk.out/tree.json - リソースツリー
```

**循環参照の回避戦略（既存実装を参考）**:

- SSM Parameter Store の利用（CloudFront URL保存など）
- ワイルドカードリソース指定（`'*'`）
- L1 Construct（Cfn）の活用（後付け設定）

---

### Phase 6: 結果報告と Next Actions

**目的**: 実装結果をサマリーし、次のアクションを提案

**処理ステップ**:

1. **実装サマリーの表示**
   - Issue番号とタイトル
   - 実装したファイル一覧
   - 変更内容の要約

2. **テスト結果サマリー**
   - npm test: ✅ Passed / 🔴 Failed
   - cdk synth: ✅ Passed / 🔴 Failed
   - 循環参照チェック: ✅ OK / ⚠️ Warning

3. **Next Actions の提案**
   - 成功時:

     ```
     ### Next Steps

     1. /cdk-ci で包括的な品質チェック（静的解析、型チェック）
     2. cdk diff でデプロイ前の差分確認
     3. cdk deploy で実際にデプロイ（人間が実施）
     4. 結合テスト実行（人間が実施）
     5. /git-commit でコミット作成
     ```

   - 失敗時:

     ```
     ### Next Steps

     1. 上記のエラーを修正
     2. /cdk-dev を再実行
     ```

4. **Issue更新の提案**
   - 完了したタスクにチェックマークを付ける提案
   - Issueファイルの更新は手動（ユーザーが実施）

**出力フォーマット例**:

```markdown
## CDK実装完了レポート

### 実装サマリー

Issue: #XX {タイトル}

実装ファイル:

- cdk/lib/oidc-sandbox-stack.ts

変更内容:

- Lambda Function URLの追加
- CloudFrontのOrigin設定更新
- IAMポリシーの自動生成

### テスト結果

| チェック項目     | 結果                |
| ---------------- | ------------------- |
| npm test         | ✅ Passed (X tests) |
| cdk synth        | ✅ Passed           |
| 循環参照チェック | ✅ OK               |

### Next Steps

1. /cdk-ci で包括的な品質チェック
2. cdk diff でデプロイ前の差分確認
3. cdk deploy で実際にデプロイ（人間が実施）
4. 結合テスト実行（人間が実施）
5. /git-commit でコミット作成
```

---

## エラーハンドリング戦略

### 統一的なパターン

| エラー種別                   | 判定方法                                      | 処理内容                                                                |
| ---------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| Issueファイル検索エラー      | Glob で該当ファイルなし                       | 利用可能なファイル一覧を表示し再入力を促す（最大3回）                   |
| Issueファイルが空            | Read結果が空文字列                            | 処理を中止                                                              |
| 設計書ファイルが見つからない | Read でエラー                                 | 警告を表示し、Issueの情報のみで処理継続                                 |
| npm test 失敗                | 終了コード 非0                                | エラーメッセージを解析し、修正方法を提案                                |
| スナップショット不一致       | テストエラーメッセージに "snapshot" 含む      | AskUserQuestion でスナップショット更新の可否を確認                      |
| cdk synth 失敗               | 終了コード 非0                                | エラーメッセージを解析し、修正方法を提案                                |
| 循環参照エラー               | エラーメッセージに "Circular dependency" 含む | 原因リソースを特定し、回避方法を提案（SSM/ワイルドカード/L1 Construct） |

---

## Critical Files

### 作成するファイル

1. **`.claude/skills/cdk-dev/SKILL.md`**
   - `/cdk-dev` コマンドの定義
   - エージェント起動の実行指示
   - 出力表示の指示（全文そのまま表示）

2. **`.claude/agents/cdk-dev-agent/cdk-dev-agent.md`**
   - 6つのPhaseの詳細実装
   - エラーハンドリング一覧
   - テスト観点

### 参照するファイル

1. **`.claude/skills/tdd/SKILL.md`** - スキル定義の参考
2. **`.claude/skills/ci/SKILL.md`** - シンプルなスキル定義の参考
3. **`.claude/agents/tdd-agent/tdd-agent.md`** - 詳細なPhase構成の参考
4. **`.claude/agents/ci-runner/ci-runner.md`** - シンプルなエージェント実装の参考
5. **`.claude/agents/update-design-agent/update-design-agent.md`** - Issue解析とファイル検索の参考
6. **`docs/design/infrastructure-design.md`** - CDK設計書
7. **`.claude/rules/cdk.md`** - CDKルール
8. **`cdk/lib/oidc-sandbox-stack.ts`** - メインスタック実装
9. **`cdk/test/cdk.test.ts`** - テストファイル
10. **`CLAUDE.md`** - プロジェクト全体の指示

---

## 実装の詳細

### SKILL.md の構成

```markdown
---
name: cdk-dev
description: AWS CDK実装専用コマンド。Issueから設計書を参照してCDK実装、テスト、合成を実行
---

# CDK Dev コマンド

## 処理内容

### Phase 1: Issue読み込みと実装仕様の抽出

...

### Phase 2: 設計書参照と実装方針確認

...

### Phase 3: CDK実装

...

### Phase 4: テスト実行

...

### Phase 5: CDK合成と循環参照チェック

...

### Phase 6: 結果報告と Next Actions

...

## 使用方法

...

## 既存スキルとの違い

...

## 実行指示（Claude Code への指示）

このスキルが呼び出されたら、以下を**厳格に**実行すること:

### 1. エージェントの起動

Task ツールを使用して `cdk-dev-agent` サブエージェントを起動:
```

subagent_type: "cdk-dev-agent"
prompt: "指定されたIssueファイルからCDK実装を実行してください"

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

### cdk-dev-agent.md の構成

```markdown
---
name: cdk-dev-agent
description: IssueファイルからCDK実装を実行する専門エージェント
tools: AskUserQuestion, Glob, Read, Write, Edit, Bash
model: sonnet
---

# CDK Dev Agent

## 実行プロセス

### Phase 1: Issue読み込みと実装仕様の抽出

#### ステップ 1-1: Issue番号またはファイル名の取得

...

#### ステップ 1-2: Issueファイルの検出

...
（詳細な実装手順）

### Phase 2: 設計書参照と実装方針確認

...

### Phase 3: CDK実装

...

### Phase 4: テスト実行

...

### Phase 5: CDK合成と循環参照チェック

...

### Phase 6: 結果報告と Next Actions

...

## エラーハンドリング一覧

（表形式で各エラーパターンを記載）

## 制約事項

...

## テスト観点（実装後の検証用）

...

## 使用可能なツール

...

## 実装上の注意点

...
```

---

## 検証方法

実装後、以下の手順でテストします：

1. **スキルの動作確認**

   ```
   /cdk-dev 1
   ```

   - Issue #1（CDK Init）を指定して実行
   - エージェントが起動することを確認
   - 各Phaseが正しく実行されることを確認

2. **エラーハンドリングの確認**
   - 存在しないIssue番号を指定 → エラーメッセージとファイル一覧表示
   - Issueファイルが空 → 処理中止メッセージ表示

3. **テスト・合成の実行確認**
   - npm test が実行される
   - cdk synth が実行される
   - 結果が正しく解析される

4. **レポート出力の確認**
   - 実装サマリーが表示される
   - テスト結果サマリーが表示される
   - Next Actions が提案される

---

## まとめ

本プランでは、AWS CDK実装専用のカスタムコマンド `/cdk-dev` を以下の方針で実装します：

### 主な特徴

1. **Issue駆動の実装**: IssueとPlanから仕様を抽出
2. **設計書参照**: infrastructure-design.md等から設計意図を理解
3. **CDK実装**: ルールを遵守したCDKコード実装
4. **即座なフィードバック**: npm test + cdk synth で基本確認
5. **循環参照チェック**: CDK特有のエラーを検出
6. **スナップショット更新**: 必要に応じてスナップショットを更新

### 既存コマンドとの違い

| コマンド          | 対象                   | テスト | 静的解析 | CDK合成 |
| ----------------- | ---------------------- | ------ | -------- | ------- |
| `/tdd`            | アプリケーションコード | ✅     | ❌       | ❌      |
| `/ci`             | アプリケーションコード | ✅     | ✅       | ❌      |
| `/cdk-dev` (新規) | CDKコード              | ✅     | ❌       | ✅      |
| `/cdk-ci` (既存)  | CDKコード              | ✅     | ✅       | ✅      |

このプランに基づいて実装することで、CDK実装フローが効率化され、循環参照エラーなどのCDK特有の問題を早期に発見できるようになります。
