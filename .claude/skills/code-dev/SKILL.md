---
name: code-dev
description: 'アプリケーション実装の一気通貫オーケストレーションワークフロー。TDD実装→コードレビュー→レビュー指摘修正→CI実行→CI指摘修正→設計書整合性チェック→設計書修正を人間への確認なしに自律実行する。CLAUDE.md の開発フロー Step 6（frontend/backend実装）で使用。Issue番号を引数に指定すること（例: /code-dev 15）。CDKには使用しない。'
argument-hint: '<Issue番号>'
disable-model-invocation: true
---

# /code-dev

Issue番号: $ARGUMENTS

TDD実装 → コードレビュー → レビュー指摘修正 → CI実行 → CI指摘修正 → 設計書整合性チェック → 設計書修正 を順次自律実行する。
**全フェーズを人間への確認なしに自律実行すること。**

## 実行手順

1. **Phase 1: TDD実装** - `tdd-agent` を Task ツールで起動し、Issue番号 `$ARGUMENTS` を渡して完了を待つ。プロンプトに「人間への確認なしに自律的に実行すること」を明記すること
2. **Phase 2: コードレビュー** - Phase 1 完了後、`code-reviewer-agent` を Task ツールで起動し、完了を待つ
3. **Phase 3: レビュー指摘修正** - Phase 2 のレビュー結果に指摘事項がある場合、直接コードを修正する。指摘なしの場合はスキップ
4. **Phase 4: CI実行** - `code-ci-runner-agent` を Task ツールで起動し、完了を待つ
5. **Phase 5: CI指摘修正** - Phase 4 の結果にエラーがある場合、静的解析・テストエラーを修正する。エラーなしの場合はスキップ
6. **Phase 6: 設計書整合性チェック** - `design-validator-agent` を Task ツールで起動し、完了を待つ
7. **Phase 7: 設計書修正** - Phase 6 の結果に指摘事項がある場合、実装を正として設計書を修正する。指摘なしの場合はスキップ
8. 各フェーズの出力を**そのまま全文表示**する（要約・加工・コメント追加は禁止）

## Phase 1 (tdd-agent) 呼び出しプロンプト例

```
指定されたGitHub IssueからTDDサイクル（Red-Green-Refactor）を実行してください。
完了したタスクは `gh issue edit` コマンドでGitHub Issueのチェックリストを更新してください。

Issue指定: $ARGUMENTS

**重要**: ユーザー確認（AskUserQuestion）が必要な箇所は全て最初の選択肢（デフォルト）で自動選択し、
人間への確認なしに最後まで自律的に実行してください。
```

## エラーハンドリング

- Phase 1 失敗 → Phase 2 以降は実行しない。`/tdd $ARGUMENTS` で個別実行を案内する
- Phase 2 失敗 → Phase 1 の実装は完了済み。`/code-review` で個別実行を案内する
- Phase 3 修正不要（指摘なし）→ Phase 4 へスキップ
- Phase 4 失敗 → エラー内容を表示し中断。`/code-ci` で個別実行を案内する
- Phase 5 修正後も CI 失敗 → エラー内容を表示し、手動での修正を案内する
- Phase 6 失敗 → CI まで完了済み。`/validate-design` で個別実行を案内する
- Phase 7 修正不要（指摘なし）→ 完了
