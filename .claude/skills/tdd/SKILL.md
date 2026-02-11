---
name: tdd
description: IssueファイルからTDD（Test-Driven Development）サイクルを実行し、テストと実装を段階的に作成。backendまたはfrontendの実装にTDDを適用する際に使用。
argument-hint: '[Issue番号またはファイル名]'
disable-model-invocation: true
context: fork
agent: tdd-agent
---

指定されたIssueファイルからTDDサイクル（Red-Green-Refactor）を実行してください。

Issue指定: $ARGUMENTS
