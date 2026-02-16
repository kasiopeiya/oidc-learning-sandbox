---
name: create-issue
description: Planモードの出力からGitHub Issueを作成する。メタデータ収集、フォーマット変換を実行。
context: fork
agent: issue-creator-agent
disable-model-invocation: true
---

最新のPlanファイルをGitHub IssuesにIssue形式で作成してください。

**制約事項**:

- ローカルファイルは作成しない（`docs/issues/` へのファイル保存は行わない）
- PlanのすべてのセクションをIssueに**一字一句そのまま（verbatim）**反映すること（要約・省略・パラフレーズ禁止）
- Planの全文を `<details>` セクションとしてIssueに添付すること
- テンプレートは `assets/issue-template.md` を参照すること
- `gh issue create` コマンドでGitHub Issueを作成すること
