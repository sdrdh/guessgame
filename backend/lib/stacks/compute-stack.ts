import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';

interface ComputeStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  queue: sqs.Queue;
}

export class ComputeStack extends cdk.Stack {
  public readonly createGuessFunction: lambdaNodejs.NodejsFunction;
  public readonly resolveGuessFunction: lambdaNodejs.NodejsFunction;
  public readonly getUserFunction: lambdaNodejs.NodejsFunction;
  public readonly getGuessHistoryFunction: lambdaNodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { table, queue } = props;

    // Common Lambda environment variables
    const commonEnv = {
      TABLE_NAME: table.tableName,
      NODE_OPTIONS: '--enable-source-maps'
    };

    // Common Lambda props
    const commonProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2020'
      }
    };

    // CreateGuess Lambda
    this.createGuessFunction = new lambdaNodejs.NodejsFunction(this, 'CreateGuessFunction', {
      ...commonProps,
      functionName: 'guess-game-create-guess',
      entry: path.join(__dirname, '../../lambdas/createGuess/index.ts'),
      handler: 'handler',
      environment: {
        ...commonEnv,
        QUEUE_URL: queue.queueUrl
      }
    });

    // Grant permissions
    table.grantReadWriteData(this.createGuessFunction);
    queue.grantSendMessages(this.createGuessFunction);

    // ResolveGuess Lambda
    this.resolveGuessFunction = new lambdaNodejs.NodejsFunction(this, 'ResolveGuessFunction', {
      ...commonProps,
      functionName: 'guess-game-resolve-guess',
      entry: path.join(__dirname, '../../lambdas/resolveGuess/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(90), // Longer timeout for retries
      environment: {
        ...commonEnv,
        QUEUE_URL: queue.queueUrl
      }
    });

    // Grant permissions
    table.grantReadWriteData(this.resolveGuessFunction);
    queue.grantSendMessages(this.resolveGuessFunction); // For requeuing

    // Add SQS event source
    this.resolveGuessFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(queue, {
        batchSize: 1, // Process one message at a time
        reportBatchItemFailures: true
      })
    );

    // GetUser Lambda
    this.getUserFunction = new lambdaNodejs.NodejsFunction(this, 'GetUserFunction', {
      ...commonProps,
      functionName: 'guess-game-get-user',
      entry: path.join(__dirname, '../../lambdas/getUser/index.ts'),
      handler: 'handler',
      environment: commonEnv
    });

    // Grant permissions
    table.grantReadData(this.getUserFunction);

    // GetGuessHistory Lambda
    this.getGuessHistoryFunction = new lambdaNodejs.NodejsFunction(this, 'GetGuessHistoryFunction', {
      ...commonProps,
      functionName: 'guess-game-get-guess-history',
      entry: path.join(__dirname, '../../lambdas/getGuessHistory/index.ts'),
      handler: 'handler',
      environment: commonEnv
    });

    // Grant permissions
    table.grantReadData(this.getGuessHistoryFunction);

    // Outputs
    new cdk.CfnOutput(this, 'CreateGuessFunctionArn', {
      value: this.createGuessFunction.functionArn,
      description: 'CreateGuess Lambda ARN'
    });

    new cdk.CfnOutput(this, 'GetUserFunctionArn', {
      value: this.getUserFunction.functionArn,
      description: 'GetUser Lambda ARN'
    });
  }
}
