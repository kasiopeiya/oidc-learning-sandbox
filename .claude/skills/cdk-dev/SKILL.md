---
name: cdk-dev
description: AWS CDK実装専用コマンド。Issueから設計書を参照してCDK実装、テスト、合成を実行
---

# CDK Dev コマンド

指定したIssueファイルの内容を元に、設計書を参照してAWS CDKコードを実装し、テスト・合成まで実行するスキルです。

このスキルは、`cdk-dev-agent` サブエージェントを呼び出して、以下の6つのPhaseを自動実行します。

## 処理内容

### Phase 1: Issue読み込みと実装仕様の抽出

- `docs/issues/` 配下のIssueファイルを検索・読み込み
- Issueに記載された実装仕様を抽出
- （オプション）PlanファイルへのリンクがあればPlanも読み込み
- 対象ファイルとラベルを特定

### Phase 2: 設計書参照と実装方針確認

- ラベルから対象設計書を特定（infrastructure-design.md等）
- 設計判断サマリー、アーキテクチャ概要、補足セクションを読み込み
- CDKルール（.claude/rules/cdk.md）の確認
- 実装方針をユーザーに確認

### Phase 3: CDK実装

- Issueの対象ファイルを読み込み
- 設計書とCDKルールに基づいてコードを実装
- JSDocコメントと日本語コメントで処理を明記
- 循環参照を回避する実装パターンを適用

### Phase 4: テスト実行

- `npm test` でCDKテストを実行
- テスト失敗時はエラー分析
- スナップショット不一致時は更新可否を確認
- 必要に応じて `npm test -- -u` でスナップショット更新

### Phase 5: CDK合成と循環参照チェック

- `npx cdk synth` でCloudFormationテンプレート合成
- 循環参照エラーのチェック
- エラー時は原因特定と回避方法を提案

### Phase 6: 結果報告と Next Actions

- 実装サマリーとテスト結果サマリーを表示
- 次のアクション（/cdk-ci、cdk diff、cdk deploy等）を提案
- Issue更新の提案

## 使用方法

### 基本的な実行

```bash
/cdk-dev [Issue番号またはファイル名]
```

**引数あり:**

```bash
/cdk-dev 1                      # Issue番号で指定
/cdk-dev 1-cdk-init.md          # ファイル名で指定
```

**引数なし:**

```bash
/cdk-dev                        # 対話的にIssue番号を入力
```

### 前提条件

1. **Issueファイルが存在すること**
   - `/create-issue` で事前に作成
   - `docs/issues/` 配下に配置

2. **設計書が更新済みであること**（推奨）
   - `/design` で設計書を更新済み
   - 実装が設計書に沿っていることを確認

3. **Issueに必要な情報が記載されていること**
   - ラベル（cdk/infra/backend/frontend）
   - 対象ファイル
   - 実装する機能の説明

## CDK実装時の重要事項

エージェントは以下のCDKルールを遵守します:

- **L2 Construct優先**: 可能な限りHigh-level APIを使用
- **Import形式**: `import { aws_s3 as s3 } from 'aws-cdk-lib'` 形式に統一
- **IAM自動生成**: L2 ConstructのIAM Role自動生成機能を活用
- **循環参照の回避**: SSM Parameter Store、ワイルドカード指定、L1 Constructを活用
- **TypeScriptコンパイルは実行しない**: CLAUDE.mdの指示に従う

## 既存コマンドとの違い

### 開発フロー全体における位置付け

```
1. アイデア作成（docs/idea）
   ↓
2. Plan作成（docs/plan）
   ↓
3. Issue作成（/create-issue）
   docs/issues/XX-cdk-feature.md 作成
   ↓
4. 設計書更新（/design）
   docs/design/infrastructure-design.md 更新
   ↓
5. 設計書レビュー（人間 + /doc-reviewer）
   ↓
6. CDK実装（/cdk-dev）← 本コマンド
   cdk/lib/oidc-sandbox-stack.ts 実装
   ↓
7. 静的解析・全テスト（/cdk-ci）
   プロジェクト全体の品質チェック
   ↓
8. コードレビュー（/cdk-review）
   ↓
9. cdk diff, cdk deploy（人間が実施）
```

### 他コマンドとの違い

| コマンド                | 対象                   | テスト | 静的解析 | CDK合成 |
| ----------------------- | ---------------------- | ------ | -------- | ------- |
| `/tdd`                  | アプリケーションコード | ✅     | ❌       | ❌      |
| `/ci`                   | アプリケーションコード | ✅     | ✅       | ❌      |
| `/cdk-dev` (本コマンド) | CDKコード              | ✅     | ❌       | ✅      |
| `/cdk-ci`               | CDKコード              | ✅     | ✅       | ✅      |

**役割分担**:

- `/cdk-dev`: 実装 + 基本確認（npm test + cdk synth）
- `/cdk-ci`: 包括的品質チェック（静的解析 + テスト + cdk synth）

## 使用技術

| 項目               | 詳細                                |
| ------------------ | ----------------------------------- |
| Issue検索          | Glob (`docs/issues/*.md`)           |
| Issue/Plan読み込み | Read                                |
| 設計書読み込み     | Read (`docs/design/*.md`)           |
| CDKルール確認      | Read (`.claude/rules/cdk.md`)       |
| CDK実装            | Write, Edit                         |
| テスト実行         | Bash (`npm test`, `npm test -- -u`) |
| CDK合成            | Bash (`npx cdk synth`)              |
| ユーザー対話       | AskUserQuestion                     |
| 実装               | cdk-dev-agent サブエージェント      |

## 詳細なエージェント仕様

CDK実装の詳細ロジック、6つのPhaseの処理フロー、エラーハンドリングの詳細は、`.claude/agents/cdk-dev-agent/` で定義されています。

---

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

エージェントの出力には、CDK実装の各Phase結果、完了レポート、Next Actionが含まれているため、ユーザーにそのまま提示すること。
