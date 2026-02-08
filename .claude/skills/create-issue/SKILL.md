---
name: create-issue
description: Convert Plan mode output to Issue format with auto-numbering and metadata
---

# Create Issue from Plan

Planモードで作成した計画ファイルを、Issue形式（`docs/issues/`）に自動変換するスキルです。

このスキルは、`issue-creator-agent` サブエージェントを呼び出して、以下の処理を実行します。

## 処理内容

### 1. 最新Planファイルの検出とコピー

- `~/.claude/plans/` 配下のMarkdownファイルを検索
- 更新日時が最新のPlanファイルを特定
- Planファイルの内容を読み込み
- Planファイルを `docs/plan/` にコピー（トレーサビリティ確保のため）

### 1.5. 複数Issue分割の確認（新機能）

**対話的分割オプション**:

- Planのセクション構造（`## `レベルの見出し）を解析
- ユーザーに「複数のIssueに分割するか」を確認
- 分割する場合、区切り位置を対話的に決定
- 分割しない場合は従来通り1つのIssueを作成

**分割のメリット**:

- 大規模な初期構築などを段階的なIssueに分解できる
- Phase別、コンポーネント別などの単位でIssue管理が可能
- 依存関係を明確にしたタスク管理ができる

### 2. Issue番号の自動採番

- `docs/issues/` 配下の既存Issueファイルを検索
- ファイル名から番号を抽出（例: `16-lambda-function-url-oac.md` → `16`）
- 最大番号 + 1 を新しいIssue番号として決定
- **複数Issue作成の場合**: 連番で採番（例: #17, #18, #19）

### 3. タイトルとスラッグの生成

- Planファイルの先頭の見出し（`# タイトル`）を抽出
- タイトルから英数字のみを抽出し、スラッグを生成
- スラッグ生成ルール:
  - 日本語を除外
  - 英数字のみを残す（ハイフン、アンダースコアを含む）
  - 小文字化
  - スペースをハイフンに変換
  - 連続するハイフンを1つに統合
  - 最大50文字に制限

### 4. 対話的メタデータ入力

AskUserQuestionツールで以下を質問:

- **依存関係**: 依存するIssue番号（カンマ区切り、例: `14, 15`）
  - **複数Issue作成の場合**: Issue 2以降は前のIssueへの依存を自動提案
- **ラベル**: カテゴリラベル（カンマ区切り、例: `infra, cdk, security`）
  - **複数Issue作成の場合**: 前のIssueと同じラベルを再利用するオプションあり

### 5. Issue形式への変換

Planファイルの各セクションを、Issueフォーマットにマッピング:

| Planセクション       | Issueセクション                | 備考                               |
| -------------------- | ------------------------------ | ---------------------------------- |
| `# タイトル`         | `# Issue #XX: タイトル`        | Issue番号を付与                    |
| （自動生成）         | `### 関連ドキュメント`         | Planファイルへのリンクを自動生成   |
| `## Critical Files`  | `## 📂 コンテキスト (Context)` | ファイル一覧を箇条書きで転記       |
| `## Context`         | `### 背景 / 目的`              | 1〜2文に要約                       |
| `## 概要`            | `### 背景 / 目的`              | そのまま転記                       |
| `## 実装アプローチ`  | `### スコープ / 作業項目`      | 内容を転記                         |
| `## 実装ステップ`    | `### スコープ / 作業項目`      | ステップを箇条書きで転記           |
| （自動生成）         | `### ゴール / 完了条件`        | 空のチェックリスト3項目を生成      |
| `## 検証`            | `### テスト観点`               | そのまま転記                       |
| （Planに存在しない） | `（必要なら）要確認事項`       | 空セクション（`- （なし）`）を生成 |

### 6. ファイル書き込み

- ファイル名: `docs/issues/{番号}-{slug}.md`
- 例: `docs/issues/17-create-issue-skill.md`

## 使用方法

### 基本的な実行

```
/create-issue
```

このコマンドを実行すると、`issue-creator-agent` サブエージェントが起動し、以下の処理を自動実行します:

1. 最新のPlanファイルを検出
2. **複数Issue分割の確認**（新機能）
   - 1つのIssueとして作成 or 複数のIssueに分割
3. Issue番号を自動採番（既存の最大番号 + 1、複数の場合は連番）
4. タイトルからスラッグを生成
5. 依存関係とラベルをユーザーに質問
6. Issue形式のMarkdownを生成
7. `docs/issues/{番号}-{slug}.md` に保存
8. 成功メッセージを表示

### 実行パターン

#### パターン1: 単一Issue作成（従来通り）

小〜中規模のPlanを1つのIssueとして作成します。

```
/create-issue
→ 「1つのIssueとして作成」を選択
→ Issue #17 を作成
```

#### パターン2: 複数Issue作成（新機能）

大規模な初期構築など、Planを複数のIssueに分割して作成します。

```
/create-issue
→ 「複数のIssueに分割」を選択
→ セクション構造を確認し、区切り位置を指定
→ Issue #17, #18, #19 を作成（依存関係: #18→#17, #19→#18）
```

### ユーザー対話フロー

#### 単一Issue作成の場合

```
=== Issue Creation from Plan ===

Detected latest Plan file:
  /Users/username/.claude/plans/stateful-purring-pond.md
  Title: 設計書と実装の整合性検証機能の実装プラン

このPlanを複数のIssueに分割しますか？
  → 1つのIssueとして作成（デフォルト）

Auto-assigned Issue number: #17

Generated slug: design-implementation-validator

Output file: docs/issues/17-design-implementation-validator.md

---

Please provide metadata:

1. Dependencies (Issue numbers, comma-separated, e.g., "14, 15"):
   Enter:

2. Labels (comma-separated, e.g., "infra, cdk, security"):
   Enter: backend, validation

---

Issue file created successfully!
  Location: docs/issues/17-design-implementation-validator.md
  Issue Number: #17
  Title: 設計書と実装の整合性検証機能の実装プラン
```

#### 複数Issue作成の場合

```
=== Issue Creation from Plan ===

Detected latest Plan file:
  /Users/username/.claude/plans/initial-setup.md
  Title: OIDC学習サンドボックス初期構築プラン

Plan内のセクション構造:
  1. ## 概要
  2. ## Critical Files
  3. ## Phase 1: インフラ基盤構築
  4. ## Phase 2: バックエンド実装
  5. ## Phase 3: フロントエンド実装
  6. ## Phase 4: 統合テスト
  7. ## Verification

このPlanを複数のIssueに分割しますか？
  → 複数のIssueに分割

---

Issue 2の開始セクションを選択してください:
  → 3: Phase 1: インフラ基盤構築

Issue 3の開始セクションを選択してください:
  → 5: Phase 3: フロントエンド実装

Issue 4の開始セクションを選択してください:
  → これ以上分割しない

---

=== Issue分割プレビュー ===

以下の3個のIssueを作成します:

Issue #17: 初期構築プラン - 概要
  範囲: セクション 1-2
  - ## 概要
  - ## Critical Files

Issue #18: Phase 1-2: インフラとバックエンド実装
  範囲: セクション 3-4
  - ## Phase 1: インフラ基盤構築
  - ## Phase 2: バックエンド実装

Issue #19: Phase 3-4: フロントエンド実装とテスト
  範囲: セクション 5-7
  - ## Phase 3: フロントエンド実装
  - ## Phase 4: 統合テスト
  - ## Verification

この分割でIssueを作成しますか？
  → はい、作成します

---

Issue #17 のメタデータ:

1. Dependencies:
   → なし

2. Labels:
   → infra, planning

Issue #18 のメタデータ:

1. Dependencies:
   → 前のIssueに依存 (#17)（推奨）

2. Labels:
   → 前と同じ（infra, planning）
   ※ユーザーが変更: backend, cdk

Issue #19 のメタデータ:

1. Dependencies:
   → 前のIssueに依存 (#18)（推奨）

2. Labels:
   → 前と同じ（backend, cdk）
   ※ユーザーが変更: frontend, testing

---

Issue #17 を作成中... ✓
Issue #18 を作成中... ✓
Issue #19 を作成中... ✓

=== Multiple Issues Created Successfully ===

Created 3 issues from Plan:

Issue #17: 初期構築プラン - 概要
  Location: docs/issues/17-overview.md
  Dependencies: なし
  Labels: infra, planning

Issue #18: Phase 1-2: インフラとバックエンド実装
  Location: docs/issues/18-phase1-2.md
  Dependencies: #17
  Labels: backend, cdk

Issue #19: Phase 3-4: フロントエンド実装とテスト
  Location: docs/issues/19-phase3-4.md
  Dependencies: #18
  Labels: frontend, testing

---

All issues have been created from Plan: initial-setup.md
You can find them in: docs/issues/
```

## 使用技術

| 項目             | 詳細                                 |
| ---------------- | ------------------------------------ |
| Planファイル検出 | Glob (`~/.claude/plans/*.md`)        |
| Issue番号取得    | Glob + ファイル名パース              |
| タイトル抽出     | Read + 正規表現（`^# (.+)$`）        |
| スラッグ生成     | 英数字抽出 + 小文字化 + ハイフン置換 |
| メタデータ入力   | AskUserQuestion                      |
| Issue生成        | テンプレートベースの文字列生成       |
| ファイル書き込み | Write                                |
| 実装             | issue-creator-agent サブエージェント |

## 詳細なエージェント仕様

Issue作成ロジック、変換ルール、出力フォーマットの詳細は、`.claude/agents/issue-creator-agent/` で定義されています。

---

## 実行指示（Claude Code への指示）

このスキルが呼び出されたら、以下を**厳格に**実行すること:

### 1. エージェントの起動

Task ツールを使用して `issue-creator-agent` サブエージェントを起動:

```
subagent_type: "issue-creator-agent"
prompt: "最新のPlanファイルからIssueを作成してください"
```

### 2. 出力の表示

エージェントが完了したら、**その出力をそのまま全文表示する**こと。

**重要**: 以下の行為は**禁止**:

- エージェントの出力を要約する
- エージェントの出力を加工する
- エージェントの出力にコメントを追加する

**許可される行為**:

- エージェントの出力を全文そのまま表示する
