// 1. サードパーティライブラリ
import { useSearchParams, Link } from 'react-router-dom';

// 2. 自作モジュール
import { getErrorMessage } from '../utils/api';

/**
 * エラー画面コンポーネント
 *
 * クエリパラメータからエラーコードを取得し、
 * 対応するエラーメッセージを画面に表示します。
 *
 * クエリパラメータ:
 * - error: エラーコード（state_mismatch, access_denied など）
 */
export function ErrorPage() {
  // クエリパラメータからエラーコードを取得
  const [searchParams] = useSearchParams();
  const errorCode = searchParams.get('error');

  // エラーコードに対応するメッセージを取得
  const errorMessage = getErrorMessage(errorCode);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full px-6 py-8 bg-white shadow-md rounded-lg">
        {/* エラーヘッダー */}
        <h1 className="text-2xl font-bold text-red-600 mb-6 flex items-center">
          <span className="mr-2">&#10007;</span>
          エラー
        </h1>

        {/* エラーメッセージ */}
        <p className="text-gray-700 mb-4">{errorMessage}</p>

        {/* デバッグ用：エラーコード表示（学習目的） */}
        {/* 実際のプロダクション環境では表示しないことが推奨される */}
        {errorCode && (
          <p className="text-sm text-gray-500 mb-6">
            エラーコード: {errorCode}
          </p>
        )}

        {/* トップへ戻るリンク */}
        <Link
          to="/"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          &rarr; トップへ戻る
        </Link>
      </div>
    </div>
  );
}
