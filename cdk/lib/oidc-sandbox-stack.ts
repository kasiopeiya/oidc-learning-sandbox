import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * OIDC学習サンドボックスのメインスタック
 *
 * 以下のリソースを構築する:
 * - Amazon Cognito (OP: OpenID Provider)
 * - Amazon S3 + CloudFront (フロントエンド配信)
 * - Amazon API Gateway + Lambda (RP: Relying Party)
 */
export class OidcSandboxStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // TODO: Issue #2 - Cognito User Pool構築
    // TODO: Issue #3 - S3 + CloudFront構築
    // TODO: Issue #5 - API Gateway構築
    // TODO: Issue #6 - Lambda関数作成
  }
}
