import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as appsync from '@aws-cdk/aws-appsync-alpha';
import { Construct } from 'constructs';
import * as path from 'path';

interface IntegrationStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  api: appsync.GraphqlApi;
  apiKey: string;
}

export class IntegrationStack extends cdk.Stack {
  public readonly streamProcessorFunction: lambdaNodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: IntegrationStackProps) {
    super(scope, id, props);

    const { table, api, apiKey } = props;

    // StreamProcessor Lambda
    this.streamProcessorFunction = new lambdaNodejs.NodejsFunction(this, 'StreamProcessorFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      functionName: 'guess-game-stream-processor',
      entry: path.join(__dirname, '../../lambdas/streamProcessor/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        APPSYNC_ENDPOINT: api.graphqlUrl,
        APPSYNC_API_KEY: apiKey,
        NODE_OPTIONS: '--enable-source-maps'
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2020'
      }
    });

    // Add DynamoDB Stream event source
    this.streamProcessorFunction.addEventSource(
      new lambdaEventSources.DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        bisectBatchOnError: true,
        retryAttempts: 3
      })
    );

    // Grant permissions
    table.grantStreamRead(this.streamProcessorFunction);
    api.grant(this.streamProcessorFunction, appsync.IamResource.all(), 'appsync:GraphQL');

    // Outputs
    new cdk.CfnOutput(this, 'StreamProcessorFunctionArn', {
      value: this.streamProcessorFunction.functionArn,
      description: 'StreamProcessor Lambda ARN'
    });
  }
}
