// 1. サードパーティライブラリ
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

// 2. 自作モジュール
import { useAuth } from '../contexts/AuthContext';
import { createAccount, type AccountResponse } from '../utils/api';

/**
 * 認証成功画面（コールバック画面）コンポーネント
 *
 * ページロード時に口座作成APIを自動呼び出しし、
 * 口座番号とユーザー情報を画面に表示します。
 *
 * フロー:
 * 1. 口座作成API（/api/account）をPOSTで呼び出し
 * 2. APIがCookieのセッションIDからアクセストークンを取得
 * 3. UserInfoエンドポイントでトークンを検証
 * 4. 口座番号を生成して返却
 * 5. 画面に口座番号とユーザー情報を表示
 */
export function CallbackPage() {
  // 認証状態のContextから状態と更新関数を取得
  const { user, account, isLoading, error, setUser, setAccount, setIsLoading, setError } =
    useAuth();

  // ページマウント時に口座作成APIを呼び出し
  useEffect(() => {
    /**
     * 口座作成処理を実行
     */
    const fetchAccount = async () => {
      // ローディング開始
      setIsLoading(true);
      setError(null);

      try {
        // 口座作成APIを呼び出し
        const result = await createAccount();

        // エラーレスポンスの場合
        if ('error' in result) {
          console.error('Account creation failed', result);
          setError(result.error);
          return;
        }

        // 成功時: 型アサーションで正しい型を適用
        const accountData = result as AccountResponse;

        // ユーザー情報を設定
        setUser({
          email: accountData.email,
          sub: accountData.sub,
        });

        // 口座情報を設定
        setAccount({
          accountNumber: accountData.accountNumber,
        });

        console.log('Account created successfully', {
          accountNumber: accountData.accountNumber.substring(0, 4) + '******',
        });
      } catch (err) {
        console.error('Failed to call account API', err);
        setError('口座作成に失敗しました。もう一度お試しください。');
      } finally {
        // ローディング終了
        setIsLoading(false);
      }
    };

    fetchAccount();
  }, [setUser, setAccount, setIsLoading, setError]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full px-6 py-8 bg-white shadow-md rounded-lg">
        {/* 成功ヘッダー */}
        <h1 className="text-2xl font-bold text-green-600 mb-6 flex items-center">
          <span className="mr-2">&#10003;</span>
          認証成功
        </h1>

        {/* ユーザー情報 */}
        <dl className="mb-6 space-y-4">
          <div>
            <dt className="text-sm font-semibold text-gray-700">
              メールアドレス
            </dt>
            <dd className="mt-1 text-gray-900">
              {isLoading ? (
                <span className="text-gray-500 italic">読み込み中...</span>
              ) : error ? (
                <span className="text-gray-500">(取得失敗)</span>
              ) : (
                user?.email || '(未取得)'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-gray-700">ユーザーID</dt>
            <dd className="mt-1 text-gray-900 font-mono text-sm break-all">
              {isLoading ? (
                <span className="text-gray-500 italic">読み込み中...</span>
              ) : error ? (
                <span className="text-gray-500">(取得失敗)</span>
              ) : (
                user?.sub || '(未取得)'
              )}
            </dd>
          </div>
        </dl>

        {/* 口座情報セクション */}
        <div className="mt-8 p-5 border border-gray-200 rounded-lg bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">口座情報</h2>

          {/* ローディング表示 */}
          {isLoading && (
            <p className="text-gray-500 italic">口座を作成中...</p>
          )}

          {/* エラー表示 */}
          {error && !isLoading && (
            <p className="text-red-600">{error}</p>
          )}

          {/* 口座番号表示 */}
          {account && !isLoading && !error && (
            <dl>
              <dt className="text-sm font-semibold text-gray-700">口座番号</dt>
              <dd className="mt-1 text-xl font-bold text-blue-600 font-mono">
                {account.accountNumber}
              </dd>
            </dl>
          )}
        </div>

        {/* トップへ戻るリンク */}
        <p className="mt-8 text-center">
          <Link
            to="/"
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            &rarr; トップへ戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
