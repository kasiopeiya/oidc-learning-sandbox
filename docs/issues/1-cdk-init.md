# Issue #1: CDKプロジェクト初期化

### 背景 / 目的

AWS CDKプロジェクトの雛形を作成し、環境設定を一元管理できる基盤を構築する。すべてのインフラリソースの土台となる。

- 依存: -
- ラベル: infra

### スコープ / 作業項目

- `cdk/` ディレクトリの作成と初期化
- `parameter.ts` による環境パラメータ管理
- 空のスタッククラス作成
- `deploy.sh` スクリプト作成（フロントエンドビルド→CDKデプロイの統合）

### ゴール / 完了条件（Acceptance Criteria）

- [ ] `cdk/` ディレクトリにCDKプロジェクトが作成されている
- [ ] `cdk/parameter.ts` で envName, projectName, region が定義されている
- [ ] `cdk/bin/app.ts` でスタックがインスタンス化されている
- [ ] `cdk/lib/oidc-sandbox-stack.ts` に空のスタッククラスが存在する
- [ ] `cdk/deploy.sh` が作成され、フロントエンドビルド→CDKデプロイを実行できる
- [ ] `npx cdk synth` が正常に実行できる
