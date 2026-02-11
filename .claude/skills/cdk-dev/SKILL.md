---
name: cdk-dev
description: AWS CDK実装専用コマンド。IssueファイルからCDK実装・テスト・CDK合成まで自動実行する。CDKインフラの実装を依頼されたときに使用すること。
argument-hint: '[Issue番号またはファイル名]'
context: fork
agent: cdk-dev-agent
disable-model-invocation: true
---

指定されたIssueファイルを元に、設計書を参照してAWS CDKコードを実装し、テスト・合成まで実行してください。

Issue指定: <skill-args>

引数が空の場合は、ユーザーにIssue番号またはファイル名を確認してください。
