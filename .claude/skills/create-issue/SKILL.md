---
name: create-issue
description: Convert Plan mode output to Issue format with auto-numbering and metadata
---

# Create Issue from Plan

Planモードで作成した計画ファイルを、Issue形式（`docs/issues/`）に自動変換するスキルです。

このスキルは、`issue-creator-agent` サブエージェントを呼び出して、以下の処理を実行します。

## 処理内容

### 1. 最新Planファイルの検出

- `~/.claude/plans/` 配下のMarkdownファイルを検索
- 更新日時が最新のPlanファイルを特定
- Planファイルの内容を読み込み

### 2. Issue番号の自動採番

- `docs/issues/` 配下の既存Issueファイルを検索
- ファイル名から番号を抽出（例: `16-lambda-function-url-oac.md` → `16`）
- 最大番号 + 1 を新しいIssue番号として決定

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
- **ラベル**: カテゴリラベル（カンマ区切り、例: `infra, cdk, security`）

### 5. Issue形式への変換

Planファイルの各セクションを、Issueフォーマットにマッピング:

| Planセクション       | Issueセクション                | 備考                               |
| -------------------- | ------------------------------ | ---------------------------------- |
| `# タイトル`         | `# Issue #XX: タイトル`        | Issue番号を付与                    |
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
2. Issue番号を自動採番（既存の最大番号 + 1）
3. タイトルからスラッグを生成
4. 依存関係とラベルをユーザーに質問
5. Issue形式のMarkdownを生成
6. `docs/issues/{番号}-{slug}.md` に保存
7. 成功メッセージを表示

### ユーザー対話フロー

```
=== Issue Creation from Plan ===

Detected latest Plan file:
  /Users/username/.claude/plans/stateful-purring-pond.md
  Title: 設計書と実装の整合性検証機能の実装プラン

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
