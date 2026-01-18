#!/usr/bin/env node
import 'source-map-support/register';

import { App } from 'aws-cdk-lib';

import { devParameter } from '../parameter';
import { OidcSandboxStack } from '../lib/oidc-sandbox-stack';

const app = new App();

// 開発環境スタックのインスタンス化
new OidcSandboxStack(app, `${devParameter.projectName}-app`, {
  env: {
    region: devParameter.region,
  },
  description: 'OIDC Learning Sandbox - Authentication flow learning environment',
});
