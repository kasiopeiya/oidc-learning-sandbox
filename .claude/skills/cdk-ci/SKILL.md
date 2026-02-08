---
name: cdk-ci
description: Run static analysis, snapshot tests, and cdk synth for CDK infrastructure code
---

# CDK-CI (CDK Continuous Integration) Command

CDK インフラストラクチャコードの静的解析、Snapshotテスト、CloudFormationテンプレート生成検証を実行し、CI/CDパイプラインのローカル実行を可能にするスキルです。

このスキルは、`cdk-ci-runner` サブエージェントを呼び出して、以下の処理を実行します。

## 処理内容

### 1. Prettier によるフォーマットチェック

- ルートレベルの Prettier チェック
- フォーマット違反の検出

### 2. ESLint による静的解析

- CDK ディレクトリの ESLint チェック
- エラー/警告の検出

### 3. TypeScript ビルド

- CDK ディレクトリのビルド実行 (`npm run build`)
- コンパイルエラーの検出

### 4. Snapshot テスト実行

- CDK ディレクトリの Vitest Snapshot テスト実行
- テスト結果の確認

### 5. cdk synth 実行

- CloudFormation テンプレート生成検証
- synth エラーの検出

### 6. 詳細レポート生成

- 各チェックの成功/失敗を分析
- 失敗箇所（ファイル名:行番号）の特定
- 原因のサマリーと修正方法の提案

## 使用方法

```
/cdk-ci
```

このコマンドを実行すると、`cdk-ci-runner` サブエージェントが起動し、以下の処理を自動実行します:

1. 環境チェック（node_modules の存在確認）
2. Prettier チェック（ルートレベル）
3. ESLint チェック（CDK）
4. TypeScript ビルド（CDK）
5. Snapshot テスト実行（CDK）
6. cdk synth 実行（CloudFormation テンプレート生成検証）
7. 結果の分析
8. 詳細レポートの生成

## 実行順序

以下の順序で実行され、**最初の失敗で即座に停止**します:

1. 環境チェック（必須条件の確認）
2. Prettier チェック（最も基本的なチェック）
3. ESLint チェック（構文・コーディングスタイル）
4. TypeScript ビルド（コンパイル検証）
5. Snapshot テスト実行（インフラ構成検証）
6. cdk synth 実行（CloudFormation テンプレート生成検証）

## 出力フォーマット

### 成功時

```
✅ CDK CI Passed!

All checks completed successfully.

=== Summary ===

Prettier Check:      ✅ Passed
ESLint (CDK):        ✅ Passed
TypeScript Build:    ✅ Passed
Snapshot Tests:      ✅ Passed (X tests)
cdk synth:           ✅ Passed

=== Next Steps ===

1. git add . && git commit でコミット作成
2. git push でリモートにプッシュ
3. PR を作成してコードレビューを依頼

CIチェック完了！
```

### 失敗時

```
🔴 CI Failed: [Phase Name]

[詳細なエラーメッセージ]

修正方法:
[具体的な修正提案]

CIチェックを中断します。
```

## 既存スキルとの違い

| スキル    | スコープ                             | 用途                                 |
| --------- | ------------------------------------ | ------------------------------------ |
| `/ci`     | Backend/Frontend（アプリケーション） | アプリケーションコードの品質チェック |
| `/cdk-ci` | CDK（インフラストラクチャ）          | インフラコードの品質チェック         |

---

## 実行指示（Claude Code への指示）

このスキルが呼び出されたら、以下を**厳格に**実行すること:

### 1. エージェントの起動

Task ツールを使用して `cdk-ci-runner` サブエージェントを起動:

```
subagent_type: "cdk-ci-runner"
prompt: "CDK インフラストラクチャコードの静的解析、Snapshotテスト、cdk synth を実行してください"
```

### 2. 出力の表示

エージェントが完了したら、**その出力をそのまま全文表示する**こと。

**重要**: 以下の行為は**禁止**:

- エージェントの出力を要約する
- エージェントの出力を加工する
- エージェントの出力にコメントを追加する

**許可される行為**:

- エージェントの出力を全文そのまま表示する
