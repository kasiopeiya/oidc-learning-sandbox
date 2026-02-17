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

1. **Phase 0（Issue読み込み）**: `gh issue view $ARGUMENTS --json number,title,body,labels` でIssue情報を取得し、以降のPhaseで参照できるよう保持する
2. **Phase 1**: `update-design-agent` を Task ツールで起動し、Issue番号 `$ARGUMENTS` を渡して完了を待つ
3. **Phase 2**: Phase 1 完了後、Phase 1 で更新された設計書を対象に `doc-reviewer-agent` を Task ツールで起動し、完了を待つ。その際、Phase 0 で取得したIssue情報（番号・タイトル・スコープ）をプロンプトに含め、「このIssueの意図に基づいて設計書が更新されている」ことを伝えること
4. **Phase 3**: Phase 2 のレビュー結果をもとに `update-design-agent` を Task ツールで起動し、指摘事項を反映した設計書の修正を行う。その際以下をプロンプトに含めること：
   - Phase 2 の出力（レビュー結果）をそのまま含める
   - Phase 0 で取得したIssue情報を含める
   - **「Issueの意図に反する修正は行わないこと。レビュー指摘がIssueの計画と矛盾する場合は、Issueの意図を優先し、該当指摘はスキップすること」** という指示を明記する
5. 各フェーズの出力を**そのまま全文表示**する（要約・加工・コメント追加は禁止）

## エラーハンドリング

- Phase 1 失敗 → Phase 2, 3 を実行しない。`/update-design $ARGUMENTS` で個別実行を案内する
- Phase 2 失敗 → Phase 1 の変更は適用済み。`/doc-review` で個別実行を案内する
- Phase 3 失敗 → Phase 2 のレビュー結果は出力済み。手動での修正を案内する
