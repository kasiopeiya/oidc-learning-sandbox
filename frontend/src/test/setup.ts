/**
 * Vitestのセットアップファイル
 *
 * テスト実行前に読み込まれ、共通の設定やモックを定義します。
 */
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// 各テスト後にReact Testing Libraryのクリーンアップを実行
afterEach(() => {
  cleanup();
});
