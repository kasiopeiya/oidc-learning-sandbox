/**
 * HTTPレベルE2Eテスト
 *
 * OIDC学習サンドボックスのHTTPレベルでの動作を検証する。
 * - 静的ファイル配信
 * - 認可エンドポイントリダイレクト
 * - OIDCセキュリティパラメータ
 */
import { test, expect } from '@playwright/test';

test.describe('HTTP-001: トップページ表示', () => {
  /**
   * CloudFrontからS3の静的ファイルが正しく配信されることを確認
   */
  test('トップページが正しく表示される', async ({ page }) => {
    // トップページにアクセス
    const response = await page.goto('/');

    // HTTPステータス 200 を確認
    expect(response?.status()).toBe(200);

    // タイトルの確認
    await expect(page).toHaveTitle('OIDC学習サンドボックス');

    // ログインボタンの存在確認
    const loginButton = page.locator('#login-button');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toHaveText('口座作成');
  });
});

test.describe('HTTP-002: 認可エンドポイントリダイレクト', () => {
  /**
   * /api/auth/login が Cognito の認可エンドポイントにリダイレクトすることを確認
   */
  test('認可エンドポイントがCognitoにリダイレクトする', async ({ request }) => {
    // /api/auth/login にリクエスト（リダイレクトを追跡しない）
    const response = await request.get('/api/auth/login', {
      maxRedirects: 0,
    });

    // HTTPステータス 302 を確認
    expect(response.status()).toBe(302);

    // Locationヘッダーの取得
    const location = response.headers()['location'];
    expect(location).toBeDefined();

    // Cognito の認可エンドポイントであることを確認
    expect(location).toContain('amazoncognito.com/oauth2/authorize');

    // 必須パラメータの確認
    expect(location).toContain('response_type=code');
    expect(location).toContain('client_id=');
    expect(location).toContain('redirect_uri=');
    expect(location).toContain('scope=openid');
  });
});

test.describe('HTTP-003: 認証成功ページ表示', () => {
  /**
   * /callback.html が正しく配信されることを確認
   */
  test('認証成功ページが正しく表示される', async ({ page }) => {
    // 認証成功ページにアクセス
    const response = await page.goto('/callback.html');

    // HTTPステータス 200 を確認
    expect(response?.status()).toBe(200);

    // タイトルの確認
    await expect(page).toHaveTitle(/認証成功/);

    // 必須要素の存在確認
    await expect(page.locator('text=認証成功')).toBeVisible();
    await expect(page.locator('#user-email')).toBeAttached();
    await expect(page.locator('#user-sub')).toBeAttached();
    await expect(page.locator('text=メールアドレス')).toBeVisible();
    await expect(page.locator('text=ユーザーID')).toBeVisible();
    await expect(page.locator('text=トップへ戻る')).toBeVisible();
  });
});

test.describe('HTTP-004: エラーページ表示', () => {
  /**
   * /error.html が正しく配信されることを確認
   */
  test('エラーページが正しく表示される', async ({ page }) => {
    // エラーページにアクセス
    const response = await page.goto('/error.html');

    // HTTPステータス 200 を確認
    expect(response?.status()).toBe(200);

    // タイトルの確認
    await expect(page).toHaveTitle(/エラー/);

    // 必須要素の存在確認
    await expect(page.locator('text=エラー')).toBeVisible();
    await expect(page.locator('#error-message')).toBeAttached();
    await expect(page.locator('text=トップへ戻る')).toBeVisible();
  });
});

test.describe('HTTP-005: OIDCパラメータ検証', () => {
  /**
   * 認可リクエストにOIDCセキュリティパラメータが正しく含まれることを確認
   * - state: CSRF対策
   * - nonce: リプレイ攻撃対策
   * - code_challenge / code_challenge_method: PKCE
   */
  test('OIDCセキュリティパラメータが正しく設定される', async ({ request }) => {
    // /api/auth/login にリクエスト（リダイレクトを追跡しない）
    const response = await request.get('/api/auth/login', {
      maxRedirects: 0,
    });

    // Locationヘッダーの取得
    const location = response.headers()['location'];
    expect(location).toBeDefined();

    // stateパラメータの確認（CSRF対策）
    expect(location).toMatch(/state=[A-Za-z0-9_-]+/);

    // nonceパラメータの確認（リプレイ攻撃対策）
    expect(location).toMatch(/nonce=[A-Za-z0-9_-]+/);

    // PKCEパラメータの確認
    expect(location).toMatch(/code_challenge=[A-Za-z0-9_-]+/);
    expect(location).toContain('code_challenge_method=S256');
  });

  test('stateとnonceが十分な長さを持つ', async ({ request }) => {
    // /api/auth/login にリクエスト（リダイレクトを追跡しない）
    const response = await request.get('/api/auth/login', {
      maxRedirects: 0,
    });

    // Locationヘッダーの取得
    const location = response.headers()['location'];
    expect(location).toBeDefined();

    // URLをパースしてパラメータを取得
    const url = new URL(location);
    const state = url.searchParams.get('state');
    const nonce = url.searchParams.get('nonce');
    const codeChallenge = url.searchParams.get('code_challenge');

    // state は最低32文字（Base64URL形式で32バイト以上をエンコード）
    expect(state).not.toBeNull();
    expect(state!.length).toBeGreaterThanOrEqual(32);

    // nonce は最低32文字
    expect(nonce).not.toBeNull();
    expect(nonce!.length).toBeGreaterThanOrEqual(32);

    // code_challenge は最低43文字（SHA256ハッシュのBase64URLエンコード）
    expect(codeChallenge).not.toBeNull();
    expect(codeChallenge!.length).toBeGreaterThanOrEqual(43);
  });
});
