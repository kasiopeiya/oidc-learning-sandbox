---
name: cdk-imp
description: AWS CDK実装専用コマンド。GitHub IssueからCDK実装・テスト・CDK合成まで自動実行する。CDKインフラの実装を依頼されたときに使用すること。
argument-hint: '<Issue番号>'
context: fork
agent: cdk-imp-agent
disable-model-invocation: true
---

指定されたGitHub Issueを元に、設計書を参照してAWS CDKコード（cdk/ディレクトリ配下）のみを実装し、テスト・合成まで実行してください。
backend/やfrontend/配下のアプリケーションコードは絶対に実装・変更しないでください。
Issueのタスク一覧のうち、CDK/インフラに関するタスクのみを対象としてください。
完了したCDKタスクのみ `gh issue edit` コマンドでGitHub Issueのチェックリストを更新してください。

Issue指定: <skill-args>

引数が空の場合は、ユーザーにIssue番号を確認してください。
