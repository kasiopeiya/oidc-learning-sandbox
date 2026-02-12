---
name: design
description: 統合設計ワークフロー。GitHub IssueをもとにIssueを読み込み設計書（docs/design/）を更新し、自動レビューと修正まで実行する。仕様駆動開発のStep 4で使用。Issue番号を引数に指定すること（例: /design 15）
argument-hint: '<Issue番号>'
disable-model-invocation: true
---

# /design

Issue番号: $ARGUMENTS

設計書更新（Phase 1）→ 設計書レビュー（Phase 2）→ レビュー結果に基づく修正（Phase 3）を順次実行する。  
人間への確認なしに自律的に実行する。

## 実行手順

1. **Phase 1**: `update-design-agent` を Task ツールで起動し、Issue番号 `$ARGUMENTS` を渡して完了を待つ
2. **Phase 2**: Phase 1 完了後、Phase 1 で更新された設計書を対象に `doc-reviewer-agent` を Task ツールで起動し、完了を待つ
3. **Phase 3**: Phase 2 のレビュー結果をもとに `update-design-agent` を Task ツールで起動し、指摘事項を反映した設計書の修正を行う。その際 Phase 2 の出力をそのままプロンプトに含めること
4. 各フェーズの出力を**そのまま全文表示**する（要約・加工・コメント追加は禁止）

## エラーハンドリング

- Phase 1 失敗 → Phase 2, 3 を実行しない。`/update-design $ARGUMENTS` で個別実行を案内する
- Phase 2 失敗 → Phase 1 の変更は適用済み。`/doc-review` で個別実行を案内する
- Phase 3 失敗 → Phase 2 のレビュー結果は出力済み。手動での修正を案内する
