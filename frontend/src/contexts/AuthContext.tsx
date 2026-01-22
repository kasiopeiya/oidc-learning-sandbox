// 1. サードパーティライブラリ
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

/**
 * ユーザー情報の型定義
 */
export interface UserInfo {
  /** ユーザーのメールアドレス */
  email: string;
  /** ユーザーの一意識別子（sub claim） */
  sub: string;
}

/**
 * 口座情報の型定義
 */
export interface AccountInfo {
  /** 口座番号 */
  accountNumber: string;
}

/**
 * 認証状態のContext型定義
 */
interface AuthContextType {
  /** ユーザー情報（認証済みの場合） */
  user: UserInfo | null;
  /** 口座情報（口座作成済みの場合） */
  account: AccountInfo | null;
  /** ローディング状態 */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** ユーザー情報を設定 */
  setUser: (user: UserInfo | null) => void;
  /** 口座情報を設定 */
  setAccount: (account: AccountInfo | null) => void;
  /** ローディング状態を設定 */
  setIsLoading: (isLoading: boolean) => void;
  /** エラーを設定 */
  setError: (error: string | null) => void;
  /** 状態をリセット */
  reset: () => void;
}

/**
 * 認証状態Context
 *
 * アプリケーション全体で認証状態を共有するためのContextです。
 * - ユーザー情報（email, sub）
 * - 口座情報（accountNumber）
 * - ローディング・エラー状態
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthContext Providerコンポーネント
 *
 * アプリケーションのルートで使用し、認証状態を提供します。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // ユーザー情報
  const [user, setUser] = useState<UserInfo | null>(null);

  // 口座情報
  const [account, setAccount] = useState<AccountInfo | null>(null);

  // ローディング状態
  const [isLoading, setIsLoading] = useState(false);

  // エラー状態
  const [error, setError] = useState<string | null>(null);

  // 状態をリセットする関数
  const reset = useCallback(() => {
    setUser(null);
    setAccount(null);
    setIsLoading(false);
    setError(null);
  }, []);

  // Context値を構築
  const value: AuthContextType = {
    user,
    account,
    isLoading,
    error,
    setUser,
    setAccount,
    setIsLoading,
    setError,
    reset,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * AuthContextを使用するためのカスタムフック
 *
 * @returns 認証状態のContext
 * @throws AuthProvider外で使用された場合にエラー
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  // AuthProvider外で使用された場合はエラー
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
