# Backend Development Guide

AWS CDK serverless backend with Lambda, DynamoDB, AppSync, and SQS.

## Quick Commands

```bash
npm install              # Install dependencies
npm run build           # Compile TypeScript
npm test                # Run 67 tests
npm run deploy          # Deploy all stacks + frontend
npx cdk diff            # Preview changes
npx cdk destroy --all   # Tear down
```

## Architecture

### 7 CDK Stacks (Deployment Order)

1. **DatabaseStack** - DynamoDB single table
2. **QueueStack** - SQS queue (60s delay)
3. **ComputeStack** - 6 Lambda functions
4. **AuthStack** - Cognito (needs ComputeStack's postConfirmation Lambda)
5. **ApiStack** - AppSync GraphQL
6. **IntegrationStack** - DynamoDB Streams → Lambda
7. **FrontendStack** - S3 static site (independent)

**Critical**: ComputeStack MUST deploy before AuthStack.

See: [backend/bin/app.ts](bin/app.ts)

### DynamoDB Single-Table Design

One table, composite keys (PK + SK):

| Entity | PK | SK |
|--------|----|----|
| User | `USER#<userId>` | `PROFILE` |
| Guess | `USER#<userId>` | `GUESS#<timestamp>` |
| Price | `INSTRUMENT#<instrument>` | `TIMESTAMP#<timestamp>` |

**Key features**:
- Timestamp in SK for natural ordering
- FilterExpression for resolved/unresolved guesses
- Range queries for price lookups
- TTL on price cache (7 days)

See: [lambdas/shared/db.ts](lambdas/shared/db.ts)

### Lambda Functions

**AppSync Resolvers**:
- `createGuess` - Validate, create guess, enqueue to SQS
- `getUser` - Fetch user + active guess
- `getGuessHistory` - Fetch resolved guesses

**Event-Driven**:
- `resolveGuess` - SQS consumer, resolves after 60s, **requeues if price unchanged**
- `postConfirmation` - Cognito trigger, creates user profile
- `streamProcessor` - DynamoDB Streams → AppSync mutations (real-time updates)

**Shared**: [lambdas/shared/](lambdas/shared/) (db.ts, instrumentPrice.ts)

### Key Patterns

**SQS Retry Pattern**:
```
1. SQS message arrives (60s delay)
2. Fetch price after startTime
3. If no price or price == startPrice:
   → Requeue with 5s delay
4. Else: Resolve guess, update score
```

**Price Caching**:
- Cache TTL: 5 seconds
- Check DynamoDB before CoinGecko API
- Reduces API calls, enables concurrent resolution

**Real-time Updates**:
```
DynamoDB change → Streams → streamProcessor → AppSync mutations → Frontend subscriptions
```

### GraphQL Schema

[schema/schema.graphql](../schema/schema.graphql)

**Auth modes**:
- Cognito User Pools: User operations
- API Key: Internal mutations (streamProcessor)

**Subscriptions**: `onGuessUpdated`, `onPriceUpdated`

## Common Tasks

### Add Lambda Function

1. Create `lambdas/myFunction/index.ts`
2. Register in `lib/stacks/compute-stack.ts`
3. Add to `lib/stacks/api-stack.ts` if AppSync resolver
4. Deploy: `npm run deploy`

### Modify GraphQL Schema

1. Edit `schema/schema.graphql`
2. Update Lambda types
3. Update frontend queries
4. Deploy: `npm run deploy`

### Run Single Test

```bash
npm test -- -t "test pattern"
```

## Deployment

### Local Deployment

#### Deploy to Development

```bash
cd backend

# Deploy backend stacks
npm run deploy:backend -- \
  --context environmentTag=dev \
  --context domainName=guessgame.dev.sdrdhlab.xyz

# Deploy frontend (builds automatically with backend outputs)
npm run deploy:frontend -- \
  --context environmentTag=dev \
  --context domainName=guessgame.dev.sdrdhlab.xyz

# Or deploy everything at once
npm run deploy -- \
  --context environmentTag=dev \
  --context domainName=guessgame.dev.sdrdhlab.xyz
```

**Stack names**: `GuessGameDevDatabaseStack`, `GuessGameDevAuthStack`, etc.

#### Deploy to Production

```bash
cd backend

# Deploy everything
npm run deploy -- \
  --context environmentTag=prod \
  --context domainName=guessgame.sdrdhlab.xyz
```

**Stack names**: `GuessGameDatabaseStack`, `GuessGameAuthStack`, etc.

#### Frontend-Only Deployment

After backend is deployed, you can redeploy just the frontend:

```bash
cd backend
npm run deploy:frontend -- \
  --context environmentTag=dev \
  --context domainName=guessgame.dev.sdrdhlab.xyz
```

This will:
1. Read `cdk-outputs.json` from previous backend deployment
2. Generate `frontend/.env` with AWS configuration
3. Run `npm ci && npm run build` in frontend directory
4. Deploy to S3

### Environment-Based Stack Naming

Stack names are automatically prefixed based on `environmentTag`:

| Environment | Stack Prefix | Example |
|-------------|--------------|---------|
| `prod` | `GuessGame` | `GuessGameDatabaseStack` |
| `dev` | `GuessGameDev` | `GuessGameDevDatabaseStack` |
| `staging` | `GuessGameStaging` | `GuessGameStagingDatabaseStack` |

This allows multiple environments to coexist in the same AWS account.

### Default Context Values

Default values in [cdk.json](cdk.json):
```json
{
  "environmentTag": "dev",
  "domainName": "guessgame.dev.sdrdhlab.xyz"
}
```

Override via command line: `--context environmentTag=prod`

## CI/CD with GitHub Actions

### Workflow Overview

Automated deployment via GitHub Actions: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

**Branch-based deployment**:
- Push to `main` → deploys to **prod** (`guessgame.sdrdhlab.xyz`)
- Push to `dev` → deploys to **dev** (`guessgame.dev.sdrdhlab.xyz`)

**Manual deployment**:
- GitHub Actions → **Run workflow** → Select environment

### Workflow Steps

1. **Checkout** code
2. **Setup** Node.js with npm caching
3. **Configure** AWS credentials via OIDC (no long-lived secrets!)
4. **Install** dependencies
5. **Build** TypeScript
6. **Test** all 67 backend tests
7. **Deploy backend** (6 stacks with `--outputs-file cdk-outputs.json`)
8. **Build frontend** (runs `scripts/prepare-frontend.js`)
9. **Deploy frontend** to S3
10. **Output** CloudFlare CNAME configuration

### What Gets Deployed

**Backend stacks** (with environment prefix):
```bash
GuessGame[Env]DatabaseStack      # prod: GuessGameDatabaseStack, dev: GuessGameDevDatabaseStack
GuessGame[Env]QueueStack
GuessGame[Env]ComputeStack
GuessGame[Env]AuthStack
GuessGame[Env]ApiStack
GuessGame[Env]IntegrationStack
GuessGame[Env]FrontendStack
```

**Frontend build process**:
1. `scripts/prepare-frontend.js` reads `cdk-outputs.json`
2. Extracts `UserPoolId`, `UserPoolClientId`, `ApiUrl`
3. Writes `frontend/.env`:
   ```env
   VITE_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
   VITE_COGNITO_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
   VITE_APPSYNC_ENDPOINT=https://XXXXX.appsync-api.ap-south-1.amazonaws.com/graphql
   VITE_AWS_REGION=ap-south-1
   VITE_APPSYNC_REGION=ap-south-1
   ```
4. Runs `npm ci && npm run build`
5. CDK deploys `frontend/build` to S3

### CloudFlare Configuration

Workflow outputs S3 website endpoint for CloudFlare CNAME:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CloudFlare DNS Configuration:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Type:    CNAME
  Name:    guessgame (or guessgame.dev)
  Target:  guessgame.sdrdhlab.xyz.s3-website.ap-south-1.amazonaws.com
  Proxy:   ON (orange cloud)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Setup

See [GITHUB_ACTIONS_SETUP.md](../GITHUB_ACTIONS_SETUP.md) for:
- AWS OIDC provider setup
- IAM role creation
- GitHub Secrets configuration
- Troubleshooting

## Troubleshooting

**CDK fails**: Run `aws configure`
**Lambda timeout**: Check SQS requeuing pattern
**Unauthorized**: Verify Cognito JWT and AppSync auth modes
