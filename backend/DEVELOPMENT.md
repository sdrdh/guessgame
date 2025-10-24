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

## Troubleshooting

**CDK fails**: Run `aws configure`
**Lambda timeout**: Check SQS requeuing pattern
**Unauthorized**: Verify Cognito JWT and AppSync auth modes
