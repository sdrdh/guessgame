import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.StackProps {
  postConfirmationFunction?: lambda.IFunction;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: AuthStackProps) {
    super(scope, id, props);

    // User Pool
    this.userPool = new cognito.UserPool(this, 'GameUserPool', {
      userPoolName: 'guess-game-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false
      },
      autoVerify: {
        email: true
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false
        }
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
      // Lambda triggers
      lambdaTriggers: props?.postConfirmationFunction
        ? {
            postConfirmation: props.postConfirmationFunction
          }
        : undefined
    });

    // User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'GameUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'guess-game-web-client',
      authFlows: {
        userPassword: true,
        userSrp: true
      },
      generateSecret: false,
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      readAttributes: new cognito.ClientAttributes().withStandardAttributes({
        email: true,
        emailVerified: true
      }),
      writeAttributes: new cognito.ClientAttributes().withStandardAttributes({
        email: true
      })
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'GuessGameUserPoolId'
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'GuessGameUserPoolClientId'
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN'
    });
  }
}
