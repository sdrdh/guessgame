import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class QueueStack extends cdk.Stack {
  public readonly queue: sqs.Queue;
  public readonly dlq: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Dead Letter Queue
    this.dlq = new sqs.Queue(this, 'GuessResolutionDLQ', {
      queueName: 'btc-guess-resolution-dlq',
      retentionPeriod: cdk.Duration.days(14)
    });

    // Main Queue
    this.queue = new sqs.Queue(this, 'GuessResolutionQueue', {
      queueName: 'btc-guess-resolution',
      visibilityTimeout: cdk.Duration.seconds(90),
      deadLetterQueue: {
        queue: this.dlq,
        maxReceiveCount: 3
      }
    });

    new cdk.CfnOutput(this, 'QueueUrl', {
      value: this.queue.queueUrl,
      description: 'SQS Queue URL',
      exportName: 'GuessGameQueueUrl'
    });

    new cdk.CfnOutput(this, 'QueueArn', {
      value: this.queue.queueArn,
      description: 'SQS Queue ARN'
    });

    new cdk.CfnOutput(this, 'DLQUrl', {
      value: this.dlq.queueUrl,
      description: 'SQS Dead Letter Queue URL',
      exportName: 'GuessGameDLQUrl'
    });
  }
}
