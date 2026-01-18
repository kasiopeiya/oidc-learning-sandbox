# Issue #3: S3 + CloudFront構築

### 背景 / 目的

フロントエンドの静的ファイルをHTTPSで配信するためのS3バケットとCloudFrontディストリビューションを構築する。OIDCのコールバックURLにはHTTPSが必要。

- 依存: #1
- ラベル: infra

### スコープ / 作業項目

- S3 バケットの作成（非公開設定、RemovalPolicy.DESTROY）
- CloudFront ディストリビューションの作成
- OAC（Origin Access Control）の設定
- デフォルトルートオブジェクトの設定

### ゴール / 完了条件（Acceptance Criteria）

- [x] S3バケットが非公開設定で作成されている
- [x] CloudFront ディストリビューションが作成されている
- [x] OAC（Origin Access Control）でS3にアクセスできる
- [x] デフォルトルートオブジェクトが `index.html` に設定されている
- [x] HTTPからHTTPSへのリダイレクトが有効になっている
- [x] CloudFront URLがCDK出力に表示される

### テスト観点

- 検証方法: CloudFront URL にアクセスして静的ファイルが表示されることを確認
