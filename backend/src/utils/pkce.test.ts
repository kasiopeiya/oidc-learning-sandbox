/**
 * PKCE ユーティリティのテスト
 */
import * as crypto from 'crypto'

import { describe, it, expect } from 'vitest'

import {
  generateRandomString,
  generateState,
  generateNonce,
  generateCodeVerifier,
  generateCodeChallenge,
  generateOidcSecurityParams
} from './pkce'

describe('pkce', () => {
  describe('正常系', () => {
    describe('generateRandomString', () => {
      it('43文字のBase64URLエンコードされた文字列を生成する', () => {
        // 実行
        const result = generateRandomString()

        // 検証
        expect(result).toHaveLength(43)
      })

      it('URLセーフな文字のみを含む', () => {
        // 実行
        const result = generateRandomString()

        // 検証: Base64URL形式（A-Za-z0-9-_のみ）
        expect(result).toMatch(/^[A-Za-z0-9_-]+$/)
      })

      it('複数回実行すると異なる値を生成する（ランダム性）', () => {
        // 実行
        const results = new Set<string>()
        for (let i = 0; i < 100; i++) {
          results.add(generateRandomString())
        }

        // 検証: 100回実行してすべて異なる値
        expect(results.size).toBe(100)
      })
    })

    describe('generateState', () => {
      it('43文字のstate値を生成する', () => {
        // 実行
        const result = generateState()

        // 検証
        expect(result).toHaveLength(43)
        expect(result).toMatch(/^[A-Za-z0-9_-]+$/)
      })
    })

    describe('generateNonce', () => {
      it('43文字のnonce値を生成する', () => {
        // 実行
        const result = generateNonce()

        // 検証
        expect(result).toHaveLength(43)
        expect(result).toMatch(/^[A-Za-z0-9_-]+$/)
      })
    })

    describe('generateCodeVerifier', () => {
      it('43文字のcode_verifier値を生成する', () => {
        // 実行
        const result = generateCodeVerifier()

        // 検証
        expect(result).toHaveLength(43)
        expect(result).toMatch(/^[A-Za-z0-9_-]+$/)
      })

      it('RFC 7636の文字種要件を満たす', () => {
        // 実行
        const result = generateCodeVerifier()

        // 検証: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
        // Base64URL形式は "-" と "_" を使用するので、この要件を満たす
        expect(result).toMatch(/^[A-Za-z0-9_-]+$/)
      })
    })

    describe('generateCodeChallenge', () => {
      it('code_verifierからSHA256ハッシュのcode_challengeを生成する', () => {
        // 準備: 固定のcode_verifier
        const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'

        // 実行
        const result = generateCodeChallenge(codeVerifier)

        // 検証: SHA256ハッシュをBase64URLエンコードした43文字の文字列
        expect(result).toHaveLength(43)
        expect(result).toMatch(/^[A-Za-z0-9_-]+$/)
      })

      it('同じcode_verifierからは同じcode_challengeが生成される', () => {
        // 準備
        const codeVerifier = generateCodeVerifier()

        // 実行
        const challenge1 = generateCodeChallenge(codeVerifier)
        const challenge2 = generateCodeChallenge(codeVerifier)

        // 検証
        expect(challenge1).toBe(challenge2)
      })

      it('異なるcode_verifierからは異なるcode_challengeが生成される', () => {
        // 実行
        const verifier1 = generateCodeVerifier()
        const verifier2 = generateCodeVerifier()
        const challenge1 = generateCodeChallenge(verifier1)
        const challenge2 = generateCodeChallenge(verifier2)

        // 検証
        expect(challenge1).not.toBe(challenge2)
      })

      it('RFC 7636のS256方式と一致するハッシュを生成する', () => {
        // 準備: RFC 7636 Appendix Bのテストベクトル
        // code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        // code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
        const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'

        // 実行
        const result = generateCodeChallenge(codeVerifier)

        // 検証
        expect(result).toBe(expectedChallenge)
      })
    })

    describe('generateOidcSecurityParams', () => {
      it('state, nonce, codeVerifier, codeChallengeを一括生成する', () => {
        // 実行
        const result = generateOidcSecurityParams()

        // 検証
        expect(result.state).toHaveLength(43)
        expect(result.nonce).toHaveLength(43)
        expect(result.codeVerifier).toHaveLength(43)
        expect(result.codeChallenge).toHaveLength(43)
      })

      it('codeChallengeはcodeVerifierから計算されている', () => {
        // 実行
        const result = generateOidcSecurityParams()

        // 検証: codeVerifierから計算したcodeChallengeと一致
        const expectedChallenge = generateCodeChallenge(result.codeVerifier)
        expect(result.codeChallenge).toBe(expectedChallenge)
      })

      it('すべてのパラメータがURLセーフな文字のみを含む', () => {
        // 実行
        const result = generateOidcSecurityParams()

        // 検証
        expect(result.state).toMatch(/^[A-Za-z0-9_-]+$/)
        expect(result.nonce).toMatch(/^[A-Za-z0-9_-]+$/)
        expect(result.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/)
        expect(result.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/)
      })
    })
  })

  describe('異常系', () => {
    describe('generateCodeChallenge', () => {
      it('空文字列のcode_verifierからもcode_challengeを生成できる', () => {
        // 実行
        const result = generateCodeChallenge('')

        // 検証: SHA256('')のBase64URLエンコード
        const expectedHash = crypto.createHash('sha256').update('').digest('base64url')
        expect(result).toBe(expectedHash)
      })

      it('特殊文字を含むcode_verifierを正しく処理する', () => {
        // 実行
        const result = generateCodeChallenge('test-value_123~')

        // 検証: エラーにならず文字列が返る
        expect(typeof result).toBe('string')
        expect(result).toHaveLength(43)
      })

      it('非常に長いcode_verifierを正しく処理する', () => {
        // 準備: 1000文字のcode_verifier
        const longVerifier = 'a'.repeat(1000)

        // 実行
        const result = generateCodeChallenge(longVerifier)

        // 検証: SHA256ハッシュは入力の長さに関わらず固定長
        expect(result).toHaveLength(43)
      })
    })
  })
})
