---
name: cdk-dev
description: 'CDK実装の一気通貫オーケストレーションワークフロー。CDK実装→コードレビュー→レビュー指摘修正→CI実行→CI指摘修正を人間への確認なしに自律実行する。CLAUDE.md の開発フロー Step 7（CDK実装）で使用。Issue番号を引数に指定すること（例: /cdk-dev 15）。frontend/backend実装には使用しない。'
argument-hint: '<Issue番号>'
disable-model-invocation: true
---

# /cdk-dev

Issue番号: $ARGUMENTS

CDK実装 → コードレビュー → レビュー指摘修正 → CI実行 → CI指摘修正 を順次自律実行する。
**全フェーズを人間への確認なしに自律実行すること。**

## 実行手順

1. **Phase 1: CDK実装** - `cdk-dev-agent` を Task ツールで起動し、Issue番号 `$ARGUMENTS` を渡して完了を待つ。プロンプトに「人間への確認なしに自律的に実行すること」を明記すること
2. **Phase 2: コードレビュー** - Phase 1 完了後、`cdk-reviewer-agent` を Task ツールで起動し、完了を待つ
3. **Phase 3: レビュー指摘修正** - Phase 2 のレビュー結果に指摘事項がある場合、直接コードを修正する。指摘なしの場合はスキップ
4. **Phase 4: CI実行** - `cdk-ci-runner` を Task ツールで起動し、完了を待つ
5. **Phase 5: CI指摘修正** - Phase 4 の結果にエラーがある場合、静的解析・スナップショットテスト・cdk synthのエラーを修正する。エラーなしの場合はスキップ
6. 各フェーズの出力を**そのまま全文表示**する（要約・加工・コメント追加は禁止）

## Phase 1 (cdk-dev-agent) 呼び出しプロンプト例

```
指定されたGitHub IssueからAWS CDKコードを実装してください。
設計書を参照し、実装・テスト・cdk synthまで完了させてください。
完了したタスクは `gh issue edit` コマンドでGitHub Issueのチェックリストを更新してください。

Issue指定: $ARGUMENTS

**重要**: ユーザー確認（AskUserQuestion）が必要な箇所は全て最初の選択肢（デフォルト）で自動選択し、
人間への確認なしに最後まで自律的に実行してください。
```

## エラーハンドリング

- Phase 1 失敗 → Phase 2 以降は実行しない。`/cdk-imp $ARGUMENTS` で個別実行を案内する
- Phase 2 失敗 → Phase 1 の実装は完了済み。`/cdk-review` で個別実行を案内する
- Phase 3 修正不要（指摘なし）→ Phase 4 へスキップ
- Phase 4 失敗 → エラー内容を表示し中断。`/cdk-ci` で個別実行を案内する
- Phase 5 修正後も CI 失敗 → エラー内容を表示し、手動での修正を案内する
