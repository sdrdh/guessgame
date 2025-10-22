import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../../lib/stacks/auth-stack';
import { DatabaseStack } from '../../lib/stacks/database-stack';
import { QueueStack } from '../../lib/stacks/queue-stack';

describe('CDK Stacks', () => {
  describe('AuthStack', () => {
    it('should create a Cognito User Pool', () => {
      const app = new cdk.App();
      const stack = new AuthStack(app, 'TestAuthStack');
      const template = Template.fromStack(stack);

      template.resourceCountIs('AWS::Cognito::UserPool', 1);
      template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
    });

    it('should export User Pool ID', () => {
      const app = new cdk.App();
      const stack = new AuthStack(app, 'TestAuthStack');
      const template = Template.fromStack(stack);

      template.hasOutput('UserPoolId', {});
      template.hasOutput('UserPoolClientId', {});
    });
  });

  describe('DatabaseStack', () => {
    it('should create a DynamoDB table', () => {
      const app = new cdk.App();
      const stack = new DatabaseStack(app, 'TestDatabaseStack');
      const template = Template.fromStack(stack);

      template.resourceCountIs('AWS::DynamoDB::Table', 1);
    });

    it('should enable DynamoDB Streams', () => {
      const app = new cdk.App();
      const stack = new DatabaseStack(app, 'TestDatabaseStack');
      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::DynamoDB::Table', {
        StreamSpecification: {
          StreamViewType: 'NEW_AND_OLD_IMAGES'
        }
      });
    });

    it('should export table name and stream ARN', () => {
      const app = new cdk.App();
      const stack = new DatabaseStack(app, 'TestDatabaseStack');
      const template = Template.fromStack(stack);

      template.hasOutput('TableName', {});
      template.hasOutput('TableStreamArn', {});
    });
  });

  describe('QueueStack', () => {
    it('should create SQS queue and DLQ', () => {
      const app = new cdk.App();
      const stack = new QueueStack(app, 'TestQueueStack');
      const template = Template.fromStack(stack);

      template.resourceCountIs('AWS::SQS::Queue', 2); // Main queue + DLQ
    });

    it('should configure dead letter queue', () => {
      const app = new cdk.App();
      const stack = new QueueStack(app, 'TestQueueStack');
      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::SQS::Queue', {
        RedrivePolicy: {
          maxReceiveCount: 3
        }
      });
    });

    it('should export queue URLs', () => {
      const app = new cdk.App();
      const stack = new QueueStack(app, 'TestQueueStack');
      const template = Template.fromStack(stack);

      template.hasOutput('QueueUrl', {});
      template.hasOutput('DLQUrl', {});
    });
  });
});
