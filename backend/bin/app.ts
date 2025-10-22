#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/stacks/auth-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { QueueStack } from '../lib/stacks/queue-stack';
import { ComputeStack } from '../lib/stacks/compute-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { IntegrationStack } from '../lib/stacks/integration-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
};

// Foundation stacks (no dependencies)
const authStack = new AuthStack(app, 'GuessGameAuthStack', { env });
const databaseStack = new DatabaseStack(app, 'GuessGameDatabaseStack', { env });
const queueStack = new QueueStack(app, 'GuessGameQueueStack', { env });

// Compute stack depends on database and queue
const computeStack = new ComputeStack(app, 'GuessGameComputeStack', {
  env,
  table: databaseStack.table,
  queue: queueStack.queue
});
computeStack.addDependency(databaseStack);
computeStack.addDependency(queueStack);

// API stack depends on auth and compute
const apiStack = new ApiStack(app, 'GuessGameApiStack', {
  env,
  userPool: authStack.userPool,
  createGuessFunction: computeStack.createGuessFunction,
  getUserFunction: computeStack.getUserFunction
});
apiStack.addDependency(authStack);
apiStack.addDependency(computeStack);

// Integration stack depends on database and API (for streamProcessor)
const integrationStack = new IntegrationStack(app, 'GuessGameIntegrationStack', {
  env,
  table: databaseStack.table,
  api: apiStack.api,
  apiKey: apiStack.apiKey
});
integrationStack.addDependency(databaseStack);
integrationStack.addDependency(apiStack);

// Add tags to all stacks
cdk.Tags.of(app).add('Project', 'GuessGame');
cdk.Tags.of(app).add('Environment', 'dev');

app.synth();
