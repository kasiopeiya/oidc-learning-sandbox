---
name: update-design
description: 指定したIssueを元に設計書を自律的に更新する仕様駆動開発サポートコマンド。Issue番号を引数で指定可能（例: /update-design 15）
argument-hint: <Issue番号>
context: fork
agent: update-design-agent
disable-model-invocation: true
---

Issue番号: $ARGUMENTS

GitHub Issueの内容を解析し、該当する `docs/design/` 配下の設計書を自律的に更新してください。
更新後のレビューは `/doc-reviewer` と人間が実施するため、対話的な確認は最小限にし自律的に作業を完了してください。
完了したタスクは `gh issue edit` コマンドでGitHub Issueのチェックリストを更新してください。
