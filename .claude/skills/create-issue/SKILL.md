---
name: create-issue
description: Planモードの出力からIssueを作成する。自動採番、メタデータ収集、フォーマット変換を実行。
context: fork
agent: issue-creator-agent
disable-model-invocation: true
---

最新のPlanファイルを `docs/issues/` にIssue形式で保存してください。

**制約事項**:

- Issueファイルのみ作成する（`docs/plan/` へのPlan保存は行わない）
- PlanのすべてのセクションをIssueに反映する
- テンプレートは `assets/issue-template.md` を参照すること
