# Issue #{{issue_number}}: {{title}}

{{#if dependencies}}- 依存: {{dependencies_list}}
{{/if}}{{#if labels}}- ラベル: {{labels_list}}
{{/if}}

## 背景 / 目的

{{background}}

{{#if context}}

## 📂 コンテキスト

> 実装の起点となるファイルやディレクトリ

{{context}}

{{/if}}

## スコープ / 作業項目

{{scope}}

## タスク一覧

{{tasks_checklist}}

{{#if test_notes}}

## テスト観点

{{test_notes}}

{{/if}}{{#if notes}}

## 技術的な注意点

{{notes}}

{{/if}}{{#if references}}

## 参考資料

{{references}}
{{/if}}
