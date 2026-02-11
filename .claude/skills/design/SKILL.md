---
name: design
description: 統合設計ワークフロー。Issue（docs/issues/）から設計書（docs/design/）を更新し、自動レビューまで実行する。仕様駆動開発のStep 4で使用。「設計書を更新して」などの明示的な指示で起動すること。
argument-hint: '[issue番号]'
disable-model-invocation: true
---

# /design

設計書更新（Phase 1）→ 設計書レビュー（Phase 2）を順次実行する。

## 実行手順

1. **Phase 1**: `update-design-agent` を Task ツールで起動し、完了を待つ
2. **Phase 2**: Phase 1 完了後、`doc-reviewer-agent` を Task ツールで起動する
3. 各エージェントの出力を**そのまま全文表示**する（要約・加工・コメント追加は禁止）

## エラーハンドリング

- Phase 1 失敗 → Phase 2 を実行しない。`/update-design` で個別実行を案内する
- Phase 2 失敗 → Phase 1 の変更は適用済み。`/doc-reviewer` で個別実行を案内する
