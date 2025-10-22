import * as cdk from 'aws-cdk-lib';
import * as appsync from '@aws-cdk/aws-appsync-alpha';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  createGuessFunction: lambda.Function;
  getUserFunction: lambda.Function;
}

export class ApiStack extends cdk.Stack {
  public readonly api: appsync.GraphqlApi;
  public readonly apiKey: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { userPool, createGuessFunction, getUserFunction } = props;

    // Create AppSync API
    this.api = new appsync.GraphqlApi(this, 'GuessGameApi', {
      name: 'guess-game-api',
      schema: appsync.SchemaFile.fromAsset(path.join(__dirname, '../../schema/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool
          }
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.API_KEY,
            apiKeyConfig: {
              name: 'stream-processor-key',
              description: 'API Key for internal stream processor',
              expires: cdk.Expiration.after(cdk.Duration.days(365))
            }
          }
        ]
      },
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL
      },
      xrayEnabled: true
    });

    // Create Lambda data sources
    const createGuessDataSource = this.api.addLambdaDataSource(
      'CreateGuessDataSource',
      createGuessFunction
    );

    const getUserDataSource = this.api.addLambdaDataSource(
      'GetUserDataSource',
      getUserFunction
    );

    // Create resolvers for queries
    getUserDataSource.createResolver('GetUserResolver', {
      typeName: 'Query',
      fieldName: 'getUser'
    });

    // Create resolvers for mutations
    createGuessDataSource.createResolver('CreateGuessResolver', {
      typeName: 'Mutation',
      fieldName: 'createGuess'
    });

    // Create NONE data source for internal mutations (handled by subscriptions)
    const noneDataSource = this.api.addNoneDataSource('NoneDataSource');

    // updateGuessStatus - pass-through resolver for subscriptions
    noneDataSource.createResolver('UpdateGuessStatusResolver', {
      typeName: 'Mutation',
      fieldName: 'updateGuessStatus',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
        {
          "version": "2017-02-28",
          "payload": $util.toJson($context.arguments)
        }
      `),
      responseMappingTemplate: appsync.MappingTemplate.fromString(`
        #set($guess = $context.arguments.guess)
        {
          "guessId": "$guess.guessId",
          "direction": "$guess.direction",
          "startPrice": $guess.startPrice,
          "startTime": $guess.startTime,
          "resolved": $guess.resolved,
          "endPrice": $guess.endPrice,
          "correct": $guess.correct,
          "scoreChange": $guess.scoreChange,
          "resolvedAt": $guess.resolvedAt
        }
      `)
    });

    // updatePrice - pass-through resolver for subscriptions
    noneDataSource.createResolver('UpdatePriceResolver', {
      typeName: 'Mutation',
      fieldName: 'updatePrice',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
        {
          "version": "2017-02-28",
          "payload": $util.toJson($context.arguments)
        }
      `),
      responseMappingTemplate: appsync.MappingTemplate.fromString(`
        {
          "instrument": "$context.arguments.instrument",
          "price": $context.arguments.price,
          "timestamp": $context.arguments.timestamp
        }
      `)
    });

    // Store API key for use in IntegrationStack
    this.apiKey = this.api.apiKey || '';

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.graphqlUrl,
      description: 'AppSync GraphQL API URL',
      exportName: 'GuessGameApiUrl'
    });

    new cdk.CfnOutput(this, 'ApiKey', {
      value: this.apiKey,
      description: 'AppSync API Key',
      exportName: 'GuessGameApiKey'
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.apiId,
      description: 'AppSync API ID'
    });
  }
}
