---
name: git-commit
description: Analyze git changes and automatically create formatted commits
---

# Git Commit Helper

git の変更内容を分析して、適切なコミットメッセージを自動生成し、ユーザーの確認後にコミットを実行するスキルです。

このスキルは、`git-commit-agent` サブエージェントを呼び出して、以下の処理を実行します：

## 処理内容

### 1. 変更内容の分析

- `git status` で現在のステージング状態を確認
- `git diff` で変更内容を詳細に取得
- ファイルの追加（A）、修正（M）、削除（D）を分類

### 2. コミットメッセージの自動生成

- ファイルパスと変更タイプから `type` を判定（feat/fix/test/docs/refactor/chore）
- 変更内容から 30 文字以内の説明（description）を生成
- `type: description` フォーマットのメッセージを作成

### 2.5. 複数コミットへの自動分割

- 異なる `type` のファイルが混在している場合、自動的に分割を提案
- 各 type ごとに独立したコミットを生成
- ディレクトリ（backend/frontend/cdk）ごとにも分割可能

### 3. ステージング対象ファイルの決定

- 関連ファイルを自動で `git add` 対象に選定
- ソースコード、ドキュメント、設定ファイルなどを自動判定

### 4. ユーザーへの確認

- 生成されたコミットメッセージを表示
- ステージ対象ファイルを表示
- ユーザーの承認を待機（Y/n）

### 5. コミット実行

- ユーザー承認後、`git add` でファイルをステージ
- `git commit` でコミットを実行
- コミット成功後、最新の履歴を表示

## 使用方法

### 基本的な実行

```
/git-commit
```

このコマンドを実行すると、`git-commit-agent` サブエージェントが起動し、以下の処理を自動実行します：

1. 現在の git 状態を確認
2. コミット type とメッセージを生成
3. ステージング対象ファイルを判定
4. ユーザーに確認メッセージを表示
5. 承認後、コミットを実行

### ユーザー確認フロー

#### 単一コミットの場合

```
=== Git Commit Preview ===

Commit Type: feat
Description: git-commitスキルの実装

Staged Files (will be committed):
  ✓ .claude/skills/git-commit/SKILL.md
  ✓ .claude/agents/git-commit-agent/git-commit-agent.md

Unstaged Files (not included):
  - CLAUDE.md (modified)

Generated Message:
  feat: git-commitスキルの実装

Continue with commit? [Y/n]
```

#### 複数コミットに分割される場合

異なる type のファイルが混在している場合、自動的に分割を提案：

```
=== Git Commit Preview ===

Multiple commit types detected. Changes will be split into 3 commits:

📝 Commit 1 of 3
  Type: docs
  Description: README の更新
  Files:
    ✓ docs/README.md

📝 Commit 2 of 3
  Type: feat
  Description: 認証機能の実装
  Files:
    ✓ backend/src/auth.ts

📝 Commit 3 of 3
  Type: test
  Description: 認証機能のテスト追加
  Files:
    ✓ backend/src/auth.test.ts

Generated Messages:
  1. docs: README の更新
  2. feat: 認証機能の実装
  3. test: 認証機能のテスト追加

Continue with all commits? [Y/n]
```

## 使用技術

| 項目         | 詳細                                       |
| ------------ | ------------------------------------------ |
| コマンド     | git status, git diff, git add, git commit  |
| 判定ロジック | ファイルパス・変更タイプから type 自動判定 |
| 実装         | git-commit-agent サブエージェント          |

## 詳細なエージェント仕様

コミット分析、メッセージ生成、確認フローの詳細は、`.claude/agents/git-commit-agent/` で定義されています。
