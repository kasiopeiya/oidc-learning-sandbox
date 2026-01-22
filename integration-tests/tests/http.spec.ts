/**
 * HTTPレベルE2Eテスト
 *
 * OIDC学習サンドボックスのHTTPレベルでの動作を検証する。
 * - 静的ファイル配信（React SPA）
 * - 認可エンドポイントリダイレクト
 * - OIDCセキュリティパラメータ
 */
import { test, expect } from '@playwright/test';

test.describe('HTTP-001: トップページ表示', () => {
  /**
   * CloudFrontからReact SPAが正しく配信されることを確認
   */
  test('トップページが正しく表示される', async ({ page }) => {
    // トップページにアクセス
    const response = await page.goto('/');

    // HTTPステータス 200 を確認
    expect(response?.status()).toBe(200);

    // タイトルの確認
    await expect(page).toHaveTitle('OIDC学習サンドボックス');

    // ログインボタンの存在確認（テキストで検索）
    const loginButton = page.getByRole('button', { name: '口座作成' });
    await expect(loginButton).toBeVisible();
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

test.describe('HTTP-003: 認証成功ページ表示（SPA）', () => {
  /**
   * /callback がSPAとして正しく配信されることを確認
   * CloudFrontのerrorResponsesによりindex.htmlが返され、
   * React Routerが/callbackをルーティングする
   */
  test('認証成功ページが正しく表示される', async ({ page }) => {
    // 認証成功ページにアクセス（SPAなので/callbackに直接アクセス）
    const response = await page.goto('/callback');

    // HTTPステータス 200 を確認（CloudFrontのerrorResponsesによりindex.htmlが返される）
    expect(response?.status()).toBe(200);

    // React SPAがロードされ、CallbackPageコンポーネントが表示されるまで待機
    // 「認証成功」テキストが表示されることを確認
    await expect(page.getByText('認証成功')).toBeVisible();

    // 必須要素の存在確認
    await expect(page.getByText('メールアドレス')).toBeVisible();
    await expect(page.getByText('ユーザーID')).toBeVisible();
    await expect(page.getByText('トップへ戻る')).toBeVisible();

    // 口座情報セクションの存在確認
    await expect(page.getByText('口座情報')).toBeVisible();
  });
});

test.describe('HTTP-004: エラーページ表示（SPA）', () => {
  /**
   * /error がSPAとして正しく配信されることを確認
   * CloudFrontのerrorResponsesによりindex.htmlが返され、
   * React Routerが/errorをルーティングする
   */
  test('エラーページが正しく表示される', async ({ page }) => {
    // エラーページにアクセス（SPAなので/errorに直接アクセス）
    const response = await page.goto('/error?error=test_error');

    // HTTPステータス 200 を確認（CloudFrontのerrorResponsesによりindex.htmlが返される）
    expect(response?.status()).toBe(200);

    // React SPAがロードされ、ErrorPageコンポーネントが表示されるまで待機
    // 「エラー」テキストが表示されることを確認
    await expect(page.getByRole('heading', { name: 'エラー' })).toBeVisible();

    // エラーメッセージが表示されることを確認
    // デフォルトのエラーメッセージ（test_errorは定義されていないため）
    await expect(page.getByText('認証に失敗しました')).toBeVisible();

    // トップへ戻るリンクの存在確認
    await expect(page.getByText('トップへ戻る')).toBeVisible();

    // エラーコードの表示確認
    await expect(page.getByText('エラーコード: test_error')).toBeVisible();
  });

  test('エラーコードに応じたメッセージが表示される', async ({ page }) => {
    // access_deniedエラーでアクセス
    await page.goto('/error?error=access_denied');

    // 対応するエラーメッセージが表示されることを確認
    await expect(page.getByText('認証がキャンセルされました')).toBeVisible();
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
