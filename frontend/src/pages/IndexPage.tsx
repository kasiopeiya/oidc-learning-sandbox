/**
 * トップ画面コンポーネント
 *
 * 「口座作成」ボタンを表示し、クリックすると認証フローを開始します。
 * ボタンをクリックすると、バックエンドの認可エンドポイント（/api/auth/login）に
 * リダイレクトされ、OIDC認証フローが開始されます。
 */
export function IndexPage() {
  /**
   * 認証フローを開始する
   *
   * バックエンドの認可エンドポイントにリダイレクトします。
   * このエンドポイントでstate, nonce, PKCEパラメータが生成され、
   * CognitoのAuthorization Endpointにリダイレクトされます。
   */
  const handleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full px-6 py-8 bg-white shadow-md rounded-lg text-center">
        {/* ページタイトル */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          OIDC学習サンドボックス
        </h1>

        {/* 説明文 */}
        <p className="text-gray-600 mb-8">
          銀行口座を作成するには認証が必要です
        </p>

        {/* 口座作成ボタン */}
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          口座作成
        </button>
      </div>
    </div>
  );
}
