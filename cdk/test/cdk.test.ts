import { describe, it, expect } from 'vitest'
import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { OidcSandboxStack } from '../lib/oidc-sandbox-stack'

describe('OidcSandboxStack', () => {
  it('should synthesize without errors', () => {
    // GIVEN
    const app = new App()

    // WHEN
    const stack = new OidcSandboxStack(app, 'TestStack')

    // THEN
    const template = Template.fromStack(stack)
    expect(template).toBeDefined()
  })
})
