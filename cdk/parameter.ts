/**
 * 環境別パラメータ設定
 * 環境固有の値をコードから分離し、一元管理する
 */

/**
 * アプリケーションパラメータの型定義
 */
export interface AppParameter {
  /** 環境名（dev, prod など） */
  envName: string
  /** プロジェクト名 */
  projectName: string
  /** AWSリージョン */
  region: string
}

/**
 * 開発環境用パラメータ
 */
export const devParameter: AppParameter = {
  envName: 'dev',
  projectName: 'oidc-sandbox',
  region: 'ap-northeast-1'
}
