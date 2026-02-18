---
name: tdd
description: GitHub IssueからTDD（Test-Driven Development）サイクルを実行し、テストと実装を段階的に作成。backendまたはfrontendの実装にTDDを適用する際に使用。
argument-hint: '<Issue番号>'
disable-model-invocation: true
context: fork
agent: tdd-agent
---

指定されたGitHub Issueからアプリケーションコード（backend/、frontend/ディレクトリ配下）のみを対象にTDDサイクル（Red-Green-Refactor）を実行してください。
cdk/配下のインフラコードは絶対に実装・変更しないでください。
Issueのタスク一覧のうち、アプリケーションコード（backend/frontend）に関するタスクのみを対象としてください。
完了したアプリケーションコードタスクのみ `gh issue edit` コマンドでGitHub Issueのチェックリストを更新してください。

Issue指定: $ARGUMENTS
