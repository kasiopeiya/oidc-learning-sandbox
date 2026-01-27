/**
 * Cookie ユーティリティのテスト
 */
import { describe, it, expect } from 'vitest'

import {
  createSecureCookie,
  createOidcCookies,
  createDeleteCookie,
  createDeleteOidcCookies,
  parseCookies,
  COOKIE_NAMES
} from './cookie'

describe('cookie', () => {
  describe('正常系', () => {
    describe('createSecureCookie', () => {
      it('セキュア属性を持つCookieを生成する', () => {
        // 実行
        const cookie = createSecureCookie({
          name: 'test_cookie',
          value: 'test_value'
        })

        // 検証
        expect(cookie).toContain('test_cookie=test_value')
        expect(cookie).toContain('Max-Age=600')
        expect(cookie).toContain('HttpOnly')
        expect(cookie).toContain('Secure')
        expect(cookie).toContain('SameSite=Lax')
        expect(cookie).toContain('Path=/')
      })

      it('カスタムのMax-Ageを設定できる', () => {
        // 実行
        const cookie = createSecureCookie({
          name: 'test_cookie',
          value: 'test_value',
          maxAge: 1800
        })

        // 検証
        expect(cookie).toContain('Max-Age=1800')
      })
    })

    describe('createOidcCookies', () => {
      it('3つのOIDC用Cookieを生成する', () => {
        // 実行
        const cookies = createOidcCookies('state123', 'nonce456', 'verifier789')

        // 検証
        expect(cookies).toHaveLength(3)
        expect(cookies[0]).toContain(`${COOKIE_NAMES.STATE}=state123`)
        expect(cookies[1]).toContain(`${COOKIE_NAMES.NONCE}=nonce456`)
        expect(cookies[2]).toContain(`${COOKIE_NAMES.CODE_VERIFIER}=verifier789`)

        // すべてのCookieがセキュア属性を持つ
        cookies.forEach((cookie) => {
          expect(cookie).toContain('HttpOnly')
          expect(cookie).toContain('Secure')
        })
      })
    })

    describe('createDeleteCookie', () => {
      it('Max-Age=0でCookie削除用のヘッダー値を生成する', () => {
        // 実行
        const cookie = createDeleteCookie('test_cookie')

        // 検証
        expect(cookie).toContain('test_cookie=')
        expect(cookie).toContain('Max-Age=0')
        expect(cookie).toContain('HttpOnly')
        expect(cookie).toContain('Secure')
      })
    })

    describe('createDeleteOidcCookies', () => {
      it('3つのOIDC用Cookieの削除ヘッダーを生成する', () => {
        // 実行
        const cookies = createDeleteOidcCookies()

        // 検証
        expect(cookies).toHaveLength(3)
        expect(cookies[0]).toContain(`${COOKIE_NAMES.STATE}=`)
        expect(cookies[1]).toContain(`${COOKIE_NAMES.NONCE}=`)
        expect(cookies[2]).toContain(`${COOKIE_NAMES.CODE_VERIFIER}=`)

        // すべてのCookieがMax-Age=0
        cookies.forEach((cookie) => {
          expect(cookie).toContain('Max-Age=0')
        })
      })
    })

    describe('parseCookies', () => {
      it('単一のCookieをパースする', () => {
        // 実行
        const result = parseCookies('name=value')

        // 検証
        expect(result).toEqual({ name: 'value' })
      })

      it('複数のCookieをパースする', () => {
        // 実行
        const result = parseCookies('name1=value1; name2=value2; name3=value3')

        // 検証
        expect(result).toEqual({
          name1: 'value1',
          name2: 'value2',
          name3: 'value3'
        })
      })

      it('値に「=」が含まれるCookieを正しくパースする', () => {
        // 実行
        const result = parseCookies('token=abc=def=ghi')

        // 検証
        expect(result).toEqual({ token: 'abc=def=ghi' })
      })

      it('URLエンコードされた値をデコードする', () => {
        // 実行
        const result = parseCookies('name=%E3%83%86%E3%82%B9%E3%83%88')

        // 検証
        expect(result).toEqual({ name: 'テスト' })
      })

      it('Cookie名の前後の空白を除去する', () => {
        // 実行
        const result = parseCookies('  name  =value')

        // 検証
        expect(result).toEqual({ name: 'value' })
      })
    })
  })

  describe('異常系', () => {
    describe('parseCookies', () => {
      it('undefinedを渡すと空のオブジェクトを返す', () => {
        // 実行
        const result = parseCookies(undefined)

        // 検証
        expect(result).toEqual({})
      })

      it('空文字列を渡すと空のオブジェクトを返す', () => {
        // 実行
        const result = parseCookies('')

        // 検証
        expect(result).toEqual({})
      })

      it('値のないCookieを正しく処理する', () => {
        // 実行
        const result = parseCookies('name=')

        // 検証
        expect(result).toEqual({ name: '' })
      })

      it('名前のないCookieは無視する', () => {
        // 実行
        const result = parseCookies('=value')

        // 検証
        expect(result).toEqual({})
      })

      it('不正なフォーマットのCookieを安全に処理する', () => {
        // 実行
        const result = parseCookies(';;;')

        // 検証
        expect(result).toEqual({})
      })

      it('名前のみのCookieを正しく処理する', () => {
        // 実行
        const result = parseCookies('name')

        // 検証
        expect(result).toEqual({ name: '' })
      })
    })
  })
})
