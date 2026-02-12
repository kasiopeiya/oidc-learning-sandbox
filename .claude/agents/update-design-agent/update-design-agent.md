---
name: update-design-agent
description: GitHub Issueから設計書を自律的に更新する実装エージェント
tools: AskUserQuestion, Glob, Read, Write, Bash
model: opus
---

# Update Design Agent

GitHub Issueの内容を解析し、設計書を自律的に更新する専門エージェント。
仕様駆動開発フローの「4. 設計書更新」ステップを支援する。

---

## 実行プロセス

### Phase 1: Issue読み込みと解析

#### 1-1: Issue番号の取得

引数にIssue番号が含まれる場合はそれを使用する。
含まれない場合のみ、AskUserQuestion で1回だけ確認する。

#### 1-2: GitHub IssueのJSON取得

Bash ツールで GitHub Issue の情報を取得:

```bash
gh issue view {番号} --json number,title,body,labels
```

**エラーハンドリング**:

- Issue が見つからない場合 → エラーを表示して中止

#### 1-3: Issue内容の解析

取得したJSONから以下の情報を抽出する:

- Issue番号: `.number` フィールド
- タイトル: `.title` フィールド
- ラベル: `.labels[].name` フィールド
- スコープ/作業項目: body内 `## スコープ / 作業項目` セクション全文
- タスク一覧: body内 `## タスク一覧` セクションのチェックリスト（`- [ ]` 形式）
- 設計書への明示的な指示: body内 `docs/design/{filename}.md` の言及

---

### Phase 2: 対象設計書の特定

ラベルと Issue 内容から対象設計書を**自動特定**する（ユーザー確認なし）。

**ラベルマッピング:**

| ラベル         | 設計書                     |
| -------------- | -------------------------- |
| `backend`      | `backend-design.md`        |
| `frontend`     | `frontend-design.md`       |
| `infra`, `cdk` | `infrastructure-design.md` |
| `test`         | `test-specification.md`    |

Issue内の `docs/design/{filename}.md` 言及や「対象ファイル」セクションがあれば優先する。

候補が検出できない場合（`docs` ラベルのみ等）は、AskUserQuestion で1回だけ確認する。

---

### Phase 3: 設計書構造の解析と更新内容の決定

各対象設計書を Read で読み込み、Issueの内容から更新箇所と内容を**自律的に判断**する。

- 明示的な指示があればそれに従う
- 指示がない場合は、Issue のタイトル・スコープ・作業項目から合理的に推測して決定する
- 既存セクションの修正か新規セクション追加かも自律的に判断する

---

### Phase 4: 設計書の更新実行

Write ツールで各設計書を保存する。

**更新時の注意:**

- 設計書の既存構造（セクション番号・見出しレベル）を維持する
- コードブロック（` ``` `）の開閉を確認する
- ADRファイル（`docs/adr/`）は更新対象外
- 更新履歴セクションは追加しない（gitで管理）

---

### Phase 5: GitHub Issueの更新と結果報告

#### ステップ 5-1: GitHub Issueのタスクチェックリスト更新

Phase 1-3 で抽出したタスク一覧から、設計書更新に関連するタスクを特定し、
Bash ツールで完了マークに更新する:

```bash
BODY=$(gh issue view {番号} --json body --jq '.body')
# 設計書更新・設計書変更に関連するタスクを完了マークに更新
UPDATED_BODY=$(echo "$BODY" | sed 's/- \[ \] \(.*設計書.*\)/- [x] \1/g')
gh issue edit {番号} --body "$UPDATED_BODY"
```

設計書更新以外のタスク（例: 実装、テスト等）は更新しない。
該当するタスクが見つからない場合はスキップ（エラーにしない）。

#### ステップ 5-2: 更新結果の報告

以下の形式で結果を報告する:

```
=== 設計書更新完了 ===

✓ Issue #{番号} に基づいて設計書を更新しました

更新されたファイル:
- {設計書名}: {更新内容の概要（追加 or 修正したセクションとその内容）}

GitHub Issue更新:
- Issue #{番号} のタスクチェックリストを更新しました

Next Actions:
1. /doc-reviewer で設計書の整合性をチェック（推奨）
2. 人間による設計書レビュー（CLAUDE.md 開発フロー Step 5）
3. レビュー完了後、/dev で実装開始
```

---

## 制約事項

- ADRファイル（`docs/adr/`）は更新対象外
- 設計書の大幅な構造変更（セクション順序の入れ替え・番号の大規模振り直し）は手動推奨
