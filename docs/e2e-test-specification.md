# E2Eテスト仕様書

## 1. 概要

本ドキュメントは、OIDC学習サンドボックスのE2E（End-to-End）テスト仕様を定義します。
curlコマンドを使用したHTTPレベルでの動作確認と、ブラウザを使用した手動テストの両方を含みます。

### 1.1 テスト対象

| 項目         | 値                                                 |
| ------------ | -------------------------------------------------- |
| 対象システム | OIDC学習サンドボックス                             |
| テスト種別   | E2E（手動テスト）                                  |
| テスト環境   | AWS（CloudFront + API Gateway + Lambda + Cognito） |

### 1.2 前提条件

- CDKデプロイが完了していること
- CloudFront URLが取得できていること
- curlコマンドが利用可能であること（HTTPテスト用）
- ブラウザが利用可能であること（手動テスト用）

---

## 2. curlコマンドによるHTTPレベルテスト

### 2.1 テスト環境変数の設定

```bash
# テスト対象のCloudFront URL（デプロイ時の出力値を設定）
export CLOUDFRONT_URL="https://xxxxx.cloudfront.net"
```

---

### 2.2 テストケース一覧

| ID       | テストケース名                 | 確認観点                             |
| -------- | ------------------------------ | ------------------------------------ |
| HTTP-001 | トップページ表示               | 静的ファイルが正しく配信されるか     |
| HTTP-002 | 認可エンドポイントリダイレクト | 認可URLが正しく生成されるか          |
| HTTP-003 | 認証成功ページ表示             | コールバックページが配信されるか     |
| HTTP-004 | エラーページ表示               | エラーページが配信されるか           |
| HTTP-005 | OIDCパラメータ検証             | state/nonce/PKCEが正しく設定されるか |

---

### 2.3 テストケース詳細

#### HTTP-001: トップページ表示

**確認観点**

- CloudFrontからS3の静的ファイルが正しく配信されること
- index.htmlが返却されること
- 「口座作成」ボタンのHTML要素が含まれること

**コマンド**

```bash
curl -s "${CLOUDFRONT_URL}/" | head -50
```

**期待値**

- HTTPステータス: 200 OK
- Content-Type: text/html
- レスポンスボディに以下が含まれる:
  - `<title>OIDC学習サンドボックス</title>`
  - `id="login-button"`
  - `口座作成`

**検証コマンド（自動化用）**

```bash
# ステータスコード確認
curl -s -o /dev/null -w "%{http_code}" "${CLOUDFRONT_URL}/"
# 期待値: 200

# 必須要素の存在確認
curl -s "${CLOUDFRONT_URL}/" | grep -q "login-button" && echo "PASS" || echo "FAIL"
```

---

#### HTTP-002: 認可エンドポイントリダイレクト

**確認観点**

- `/api/auth/login` が302リダイレクトを返すこと
- リダイレクト先がCognitoの認可エンドポイントであること
- 必須パラメータ（response_type, client_id, redirect_uri, scope）が含まれること

**コマンド**

```bash
curl -s -I "${CLOUDFRONT_URL}/api/auth/login"
```

**期待値**

- HTTPステータス: 302 Found
- Locationヘッダーに以下が含まれる:
  - `https://*.auth.ap-northeast-1.amazoncognito.com/oauth2/authorize`
  - `response_type=code`
  - `client_id=`
  - `redirect_uri=`
  - `scope=openid`

**検証コマンド（自動化用）**

```bash
# ステータスコード確認
curl -s -o /dev/null -w "%{http_code}" "${CLOUDFRONT_URL}/api/auth/login"
# 期待値: 302

# Locationヘッダー取得
curl -s -I "${CLOUDFRONT_URL}/api/auth/login" | grep -i "^location:"
```

---

#### HTTP-003: 認証成功ページ表示

**確認観点**

- `/callback.html` が正しく配信されること
- クエリパラメータを受け取るための要素が存在すること

**コマンド**

```bash
curl -s "${CLOUDFRONT_URL}/callback.html?email=test@example.com&sub=test-user-id"
```

**期待値**

- HTTPステータス: 200 OK
- レスポンスボディに以下が含まれる:
  - `認証成功`
  - `id="user-email"`
  - `id="user-sub"`
  - `メールアドレス`
  - `ユーザーID`

**検証コマンド（自動化用）**

```bash
# ステータスコード確認
curl -s -o /dev/null -w "%{http_code}" "${CLOUDFRONT_URL}/callback.html"
# 期待値: 200

# 必須要素の存在確認
curl -s "${CLOUDFRONT_URL}/callback.html" | grep -q "user-email" && echo "PASS" || echo "FAIL"
```

---

#### HTTP-004: エラーページ表示

**確認観点**

- `/error.html` が正しく配信されること
- エラーコードを受け取るための要素が存在すること

**コマンド**

```bash
curl -s "${CLOUDFRONT_URL}/error.html?error=access_denied"
```

**期待値**

- HTTPステータス: 200 OK
- レスポンスボディに以下が含まれる:
  - `エラー`
  - `id="error-message"`
  - `トップへ戻る`

**検証コマンド（自動化用）**

```bash
# ステータスコード確認
curl -s -o /dev/null -w "%{http_code}" "${CLOUDFRONT_URL}/error.html"
# 期待値: 200

# 必須要素の存在確認
curl -s "${CLOUDFRONT_URL}/error.html" | grep -q "error-message" && echo "PASS" || echo "FAIL"
```

---

#### HTTP-005: OIDCパラメータ検証

**確認観点**

- 認可リクエストにセキュリティパラメータが正しく含まれること
  - state: CSRF対策
  - nonce: リプレイ攻撃対策
  - code_challenge / code_challenge_method: PKCE

**コマンド**

```bash
# Locationヘッダーを取得してパラメータを確認
LOCATION=$(curl -s -I "${CLOUDFRONT_URL}/api/auth/login" | grep -i "^location:" | cut -d' ' -f2 | tr -d '\r')
echo "$LOCATION"
```

**期待値**

- Locationヘッダーに以下のパラメータが全て含まれる:

| パラメータ              | 説明                             | 形式                        |
| ----------------------- | -------------------------------- | --------------------------- |
| `state`                 | CSRF対策用ランダム文字列         | Base64URL形式、32バイト以上 |
| `nonce`                 | リプレイ攻撃対策用ランダム文字列 | Base64URL形式、32バイト以上 |
| `code_challenge`        | PKCE用チャレンジ                 | Base64URL形式               |
| `code_challenge_method` | PKCEメソッド                     | `S256`                      |

**検証コマンド（自動化用）**

```bash
LOCATION=$(curl -s -I "${CLOUDFRONT_URL}/api/auth/login" | grep -i "^location:" | cut -d' ' -f2)

# 各パラメータの存在確認
echo "$LOCATION" | grep -q "state=" && echo "state: PASS" || echo "state: FAIL"
echo "$LOCATION" | grep -q "nonce=" && echo "nonce: PASS" || echo "nonce: FAIL"
echo "$LOCATION" | grep -q "code_challenge=" && echo "code_challenge: PASS" || echo "code_challenge: FAIL"
echo "$LOCATION" | grep -q "code_challenge_method=S256" && echo "code_challenge_method: PASS" || echo "code_challenge_method: FAIL"
```

---

## 3. ブラウザによる手動テスト

### 3.1 テストケース一覧

| ID     | テストケース名             | 確認観点                           |
| ------ | -------------------------- | ---------------------------------- |
| UI-001 | 正常系：新規ユーザー登録   | 新規ユーザーが登録できること       |
| UI-002 | 正常系：認証成功画面表示   | ユーザー情報が正しく表示されること |
| UI-003 | 異常系：ログインキャンセル | エラーメッセージが表示されること   |

---

### 3.2 テストケース詳細

#### UI-001: 正常系：新規ユーザー登録

**前提条件**

- 未登録のメールアドレスを用意する
- メールを受信できる環境を用意する

**手順**

1. ブラウザで `${CLOUDFRONT_URL}/` にアクセス
2. 「口座作成」ボタンをクリック
3. Cognitoログイン画面が表示されることを確認
4. 「Sign up」リンクをクリック
5. メールアドレスとパスワードを入力して「Sign up」ボタンをクリック
6. 確認コードがメールで届くことを確認
7. 確認コードを入力して「Confirm Account」ボタンをクリック

**期待値**

- 手順3: Cognitoのログイン画面（Hosted UI）が表示される
- 手順6: 入力したメールアドレスに確認コードが届く
- 手順7: 登録が完了し、認証成功画面にリダイレクトされる

---

#### UI-002: 正常系：認証成功画面表示

**前提条件**

- UI-001が完了していること（登録済みユーザーが存在すること）

**手順**

1. ブラウザで `${CLOUDFRONT_URL}/` にアクセス
2. 「口座作成」ボタンをクリック
3. 登録済みのメールアドレスとパスワードでログイン

**期待値**

- `/callback.html` にリダイレクトされる
- 「✓ 認証成功」が表示される
- メールアドレスが正しく表示される
- ユーザーID（sub）が表示される（UUID形式）

**確認ポイント**

- URLのクエリパラメータに `email` と `sub` が含まれている
- 表示されるメールアドレスがログインに使用したものと一致する

---

#### UI-003: 異常系：ログインキャンセル

**前提条件**

- Cognitoにログインしていない状態であること
- シークレットウィンドウ（プライベートブラウジング）を使用することを推奨

**手順**

1. シークレットウィンドウで `${CLOUDFRONT_URL}/` にアクセス
2. 「口座作成」ボタンをクリック
3. Cognitoログイン画面で以下のいずれかを実行:
   - 「Back to [アプリ名]」リンクをクリック
   - ブラウザの戻るボタンをクリック

**期待値**

- `/error.html?error=access_denied` にリダイレクトされる
- 「✗ エラー」が表示される
- 「認証がキャンセルされました。」というメッセージが表示される
- 「→ トップへ戻る」リンクが表示される

---

## 4. テスト実行スクリプト

### 4.1 一括実行スクリプト

以下のスクリプトでHTTPレベルのテストを一括実行できます。

```bash
#!/bin/bash

# テスト対象URL（デプロイ後の値に置き換える）
CLOUDFRONT_URL="${CLOUDFRONT_URL:-https://xxxxx.cloudfront.net}"

echo "=========================================="
echo "E2E HTTP Test - OIDC Learning Sandbox"
echo "Target: ${CLOUDFRONT_URL}"
echo "=========================================="

# テスト結果カウンター
PASS=0
FAIL=0

# HTTP-001: トップページ表示
echo -n "HTTP-001: トップページ表示 ... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${CLOUDFRONT_URL}/")
if [ "$STATUS" = "200" ]; then
    curl -s "${CLOUDFRONT_URL}/" | grep -q "login-button"
    if [ $? -eq 0 ]; then
        echo "PASS"
        ((PASS++))
    else
        echo "FAIL (login-button not found)"
        ((FAIL++))
    fi
else
    echo "FAIL (HTTP $STATUS)"
    ((FAIL++))
fi

# HTTP-002: 認可エンドポイントリダイレクト
echo -n "HTTP-002: 認可エンドポイントリダイレクト ... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${CLOUDFRONT_URL}/api/auth/login")
if [ "$STATUS" = "302" ]; then
    LOCATION=$(curl -s -I "${CLOUDFRONT_URL}/api/auth/login" | grep -i "^location:")
    if echo "$LOCATION" | grep -q "amazoncognito.com"; then
        echo "PASS"
        ((PASS++))
    else
        echo "FAIL (invalid redirect location)"
        ((FAIL++))
    fi
else
    echo "FAIL (HTTP $STATUS, expected 302)"
    ((FAIL++))
fi

# HTTP-003: 認証成功ページ表示
echo -n "HTTP-003: 認証成功ページ表示 ... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${CLOUDFRONT_URL}/callback.html")
if [ "$STATUS" = "200" ]; then
    curl -s "${CLOUDFRONT_URL}/callback.html" | grep -q "user-email"
    if [ $? -eq 0 ]; then
        echo "PASS"
        ((PASS++))
    else
        echo "FAIL (user-email not found)"
        ((FAIL++))
    fi
else
    echo "FAIL (HTTP $STATUS)"
    ((FAIL++))
fi

# HTTP-004: エラーページ表示
echo -n "HTTP-004: エラーページ表示 ... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${CLOUDFRONT_URL}/error.html")
if [ "$STATUS" = "200" ]; then
    curl -s "${CLOUDFRONT_URL}/error.html" | grep -q "error-message"
    if [ $? -eq 0 ]; then
        echo "PASS"
        ((PASS++))
    else
        echo "FAIL (error-message not found)"
        ((FAIL++))
    fi
else
    echo "FAIL (HTTP $STATUS)"
    ((FAIL++))
fi

# HTTP-005: OIDCパラメータ検証
echo -n "HTTP-005: OIDCパラメータ検証 ... "
LOCATION=$(curl -s -I "${CLOUDFRONT_URL}/api/auth/login" | grep -i "^location:" | cut -d' ' -f2)
PARAMS_OK=true

for param in "state=" "nonce=" "code_challenge=" "code_challenge_method=S256"; do
    if ! echo "$LOCATION" | grep -q "$param"; then
        PARAMS_OK=false
        break
    fi
done

if [ "$PARAMS_OK" = true ]; then
    echo "PASS"
    ((PASS++))
else
    echo "FAIL (missing OIDC parameters)"
    ((FAIL++))
fi

# 結果サマリー
echo "=========================================="
echo "Results: ${PASS} passed, ${FAIL} failed"
echo "=========================================="

# 終了コード
if [ $FAIL -gt 0 ]; then
    exit 1
fi
exit 0
```

### 4.2 スクリプトの使用方法

```bash
# 環境変数を設定して実行
export CLOUDFRONT_URL="https://xxxxx.cloudfront.net"
chmod +x e2e-test.sh
./e2e-test.sh
```

---

## 5. テスト結果記録

### 5.1 テスト実行記録テンプレート

| 項目               | 値         |
| ------------------ | ---------- |
| テスト実行日       | YYYY-MM-DD |
| テスト実行者       |            |
| 環境URL            |            |
| デプロイバージョン |            |

### 5.2 HTTPテスト結果

| ID       | テストケース名                 | 結果        | 備考 |
| -------- | ------------------------------ | ----------- | ---- |
| HTTP-001 | トップページ表示               | PASS / FAIL |      |
| HTTP-002 | 認可エンドポイントリダイレクト | PASS / FAIL |      |
| HTTP-003 | 認証成功ページ表示             | PASS / FAIL |      |
| HTTP-004 | エラーページ表示               | PASS / FAIL |      |
| HTTP-005 | OIDCパラメータ検証             | PASS / FAIL |      |

### 5.3 ブラウザテスト結果

| ID     | テストケース名             | 結果        | 備考 |
| ------ | -------------------------- | ----------- | ---- |
| UI-001 | 正常系：新規ユーザー登録   | PASS / FAIL |      |
| UI-002 | 正常系：認証成功画面表示   | PASS / FAIL |      |
| UI-003 | 異常系：ログインキャンセル | PASS / FAIL |      |

---

## 6. 既知の制限事項

1. **ログアウト機能未実装**: 学習用途のため、ログアウト機能は実装されていません。異常系テストを行う場合は、シークレットウィンドウを使用するか、ブラウザのCookieを削除してください。

2. **自動E2Eテスト未実装**: 本ドキュメントは手動テストを対象としています。Playwright/Cypress等を使用した自動E2Eテストは将来機能として検討中です。

3. **トークン検証の詳細テスト**: IDトークンの署名検証、有効期限検証などの詳細テストは、curlコマンドでは実施が困難です。これらはログ確認またはユニットテストで補完してください。
