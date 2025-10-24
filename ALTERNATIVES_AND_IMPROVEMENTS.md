# Architecture Alternatives and Future Improvements

This document outlines the architectural decisions made for the Bitcoin price guessing game, alternatives that were considered, known limitations, and potential improvements.

## Table of Contents

- [Current Architecture Choices](#current-architecture-choices)
- [Alternatives Considered](#alternatives-considered)
- [Known Issues and Limitations](#known-issues-and-limitations)
- [Future Improvements](#future-improvements)

---

## Current Architecture Choices

### 1. SQS for Delayed Guess Resolution

**Why SQS:**
- **Cost-effective**: Pay only for messages processed, minimal overhead for low-traffic periods
- **Simple**: Straightforward message delay mechanism (60 seconds for guess resolution)
- **Reliable**: Built-in retry mechanisms and dead-letter queue support
- **Scalable**: Handles message bursts without additional configuration

**Trade-offs:**
- Limited introspection and observability out of the box
- No built-in distributed tracing without additional tools

**Observability Solutions:**
- AWS X-Ray can be easily added for distributed tracing
- Custom trace IDs can be embedded in message attributes for end-to-end tracking
- CloudWatch metrics provide basic queue depth and processing metrics

**Implementation:** See [DEVELOPMENT.md#sqs-retry-pattern](./backend/DEVELOPMENT.md#2-resolveguess) for the requeue pattern.

---

### 2. AppSync for GraphQL API

**Why AppSync:**
- **Real-time subscriptions**: Native WebSocket support for `onGuessUpdated` and `onPriceUpdated`
- **Integrated authorization**: Cognito user pools + API key authorization built-in
- **Managed infrastructure**: No API Gateway + WebSocket API management needed
- **Schema-first development**: GraphQL schema drives API contract
- **Cost-effective for real-time**: WebSocket connections included in pricing

**Trade-offs:**
- Less flexibility than API Gateway for custom request/response transformations
- Vendor lock-in to AWS AppSync-specific features

**Implementation:** See [schema/schema.graphql](./backend/schema/schema.graphql) for the full GraphQL schema.

---

## Alternatives Considered

### 1. API Gateway REST/HTTP API (Instead of AppSync)

**Why Not Chosen:**

#### Real-time Updates Problem
```
API Gateway Approach:
Client → REST API → Lambda → DynamoDB
         ↓ (polling required)
Client polls /getGuessStatus every 5 seconds for 60 seconds = 12 API calls per guess

AppSync Approach:
Client → GraphQL subscription → WebSocket connection
         ↓ (push-based)
AppSync pushes update when guess resolves = 1 message per guess
```

**Comparison Table:**

| Feature | API Gateway REST/HTTP | AppSync GraphQL |
|---------|----------------------|-----------------|
| **Real-time Updates** | Not supported (polling required) | Native WebSocket subscriptions |
| **Authorization** | Custom authorizers or Cognito integration | Built-in Cognito + API key |
| **Cost (real-time)** | High (polling = many requests) | Low (WebSocket connection reuse) |
| **Latency (real-time)** | High (polling interval + processing) | Low (push on event) |
| **Schema Validation** | Manual (Lambda validation) | Automatic (GraphQL schema) |
| **Type Safety** | OpenAPI spec (optional) | GraphQL SDL (required) |
| **Vendor Lock-in** | Lower (REST is universal) | Higher (AppSync-specific) |
| **Complexity** | Lower for simple CRUD | Higher initial setup, simpler for real-time |

**For WebSocket Support (API Gateway WebSocket API):**
- Requires connection management Lambda (connect/disconnect)
- Manual message routing and subscription management
- DynamoDB table to track connections by user
- Custom logic to push updates to connected clients
- Significantly more complex than AppSync subscriptions

**Decision:** AppSync's native subscription support and built-in Cognito authorization outweigh the vendor lock-in concerns. The guessing game's core requirement (real-time guess updates) is a perfect fit for GraphQL subscriptions.

**When API Gateway Would Be Better:**
- Purely synchronous CRUD API (no real-time updates)
- Need for custom request/response transformations not supported by AppSync
- Integration with third-party REST APIs (simple proxy)
- Cost optimization for high-throughput, low-latency synchronous requests

---

### 2. AWS Step Functions (Instead of SQS)

**Pros:**
- Built-in state machine visualization
- Better introspection and debugging tools
- Native support for wait states (equivalent to SQS delay)
- Integrated error handling and retry logic

**Cons:**
- Higher cost per execution (compared to SQS messages)
- Overkill for simple delay-and-process pattern
- Additional complexity for a single wait-then-execute workflow
- State transition overhead for simple use case

**Cost Comparison:**
```
Step Functions: $0.025 per 1,000 state transitions
- 1 guess = 3 transitions (start → wait 60s → resolve → end) = $0.000075
- 10,000 guesses/month = $0.75

SQS: $0.40 per 1 million requests
- 1 guess = 2 SQS messages (initial + potential retries) ≈ 3 requests average
- 10,000 guesses/month = 30,000 requests = $0.01

SQS is 75x cheaper for this use case.
```

**Decision:** Not worth the added cost and complexity for our use case. SQS provides sufficient functionality at lower cost.

---

### 3. Amazon EventBridge Scheduler (Instead of SQS)

**Pros:**
- Native scheduled event support
- One-time and recurring schedules
- Good integration with Lambda and other AWS services

**Cons:**
- Higher cost per scheduled event compared to SQS
- Additional complexity for managing individual schedulers per guess
- Requires cleanup of completed schedules
- Less natural fit for queue-based retry pattern

**Cost Comparison:**
```
EventBridge Scheduler: $1.00 per million invocations
- 10,000 guesses/month = $0.01

SQS: $0.40 per 1 million requests
- 10,000 guesses/month (with retries) = $0.01

Comparable cost, but SQS's requeue pattern is more natural for our retry logic.
```

**Decision:** SQS's built-in message delay and visibility timeout better match our requeue pattern needs.

---

### 4. Persistent WebSocket for Real-time Prices (Instead of On-Demand Fetch)

**Architecture (Not Implemented):**
```
Fargate/ECS Container:
├── WebSocket connection to CoinGecko/Binance API
├── Receive price updates every 1-5 seconds
└── Write to DynamoDB (INSTRUMENT#BITCOIN, TIMESTAMP#<timestamp>)

Lambda (createGuess, resolveGuess):
├── Read from DynamoDB (no external API calls)
└── Always have fresh price data (<5 seconds old)
```

**Pros:**
- True real-time price data (1-5 second granularity vs current 5-second cache)
- Eliminates external API calls during Lambda execution
- Reduces `resolveGuess` retry frequency due to missing price data
- More accurate price resolution for guesses

**Cons:**
- **Significantly higher cost**: Fargate/ECS runs continuously (24/7) vs on-demand Lambda
  - Fargate minimum: ~$15-30/month for smallest instance
  - Current Lambda cost: Near-zero for low traffic
- **Increased complexity**: Container orchestration, WebSocket connection management, health checks
- **Operational overhead**: Container monitoring, auto-restart on connection failures
- **Overkill for current scale**: 60-second guess resolution doesn't require sub-second price updates

**Decision:** Not worth the cost and complexity for current use case. Current 5-second price cache ([instrumentPrice.ts](./backend/lambdas/shared/instrumentPrice.ts)) is sufficient for 60-second guess windows.

**Revisit If:**
- Guess resolution time drops to <10 seconds
- User traffic justifies continuous price updates (>1,000 guesses/day)
- Multi-instrument support requires multiple WebSocket connections

---

## Known Issues and Limitations

### 1. SQS Retry Price Gap Issue

**Problem:**
When `resolveGuess` requeues a message (price unchanged or unavailable), it only checks:
- Prices already in DynamoDB cache
- New price fetched during retry attempt

If there are no other `resolveGuess` Lambda invocations between retries, there may be a gap in price data:

```
Timeline:
T+60s: resolveGuess checks price, unchanged from T+0s, requeues for T+65s
T+61s-T+64s: Price changes but NO Lambda fetches it (no cache updates)
T+65s: resolveGuess checks price, compares T+0s vs T+65s, might miss T+62s change
```

**Impact:**
- Low-traffic periods may have stale price comparisons
- Rare edge case where price changes multiple times between retries
- Most common during off-peak hours (late night, weekends)

**Current Mitigations:**
- Frontend polls CoinGecko every 15 seconds (provides price continuity)
- AppSync subscription pushes price updates to frontend (`onPriceUpdated`)
- 5-second cache TTL in [instrumentPrice.ts](./backend/lambdas/shared/instrumentPrice.ts) encourages frequent price refreshes
- `resolveGuess` requeues with 5-second delay (12 retries per minute = high chance of hitting cache)

**Future Fix:**
- Implement "fetch last known price within 5-second window" in `resolveGuess` (query DynamoDB range)
- Or deploy Fargate price fetcher (Improvement 5a) to eliminate gaps entirely

**Code Location:** See [resolveGuess/index.ts](./backend/lambdas/resolveGuess/index.ts) for retry logic.

---

### 2. Limited SQS Introspection

**Problem:**
- No built-in distributed tracing across SQS → Lambda → DynamoDB → AppSync
- Difficult to track individual guess lifecycle in CloudWatch Logs alone
- Requeue events not easily correlated to original guess without manual log parsing

**Current Workarounds:**
- CloudWatch Logs with structured JSON logging (includes `guessId` in all logs)
- CloudWatch Insights queries for tracking guess flow:
  ```
  fields @timestamp, @message
  | filter guessId = "abc-123"
  | sort @timestamp asc
  ```
- Manual correlation via `guessId` in SQS message body

**Impact:**
- Debugging requeue loops requires manual log analysis
- No visual service map to understand request flow
- Difficult to identify bottlenecks (e.g., SQS requeue frequency, DynamoDB throttling)

**Future Fix:**
- Add AWS X-Ray (Improvement 5c) for full distributed tracing
- Implement custom trace ID propagation via SQS message attributes

---

## Future Improvements

### 5a. Fargate Container for Real-time Price Fetching

**Implementation:**
```typescript
// ECS Fargate Task (fargate-price-fetcher)
import WebSocket from 'ws';

const ws = new WebSocket('wss://stream.coinapi.io/v1/');
ws.on('message', async (data) => {
  const priceUpdate = JSON.parse(data);
  await dynamoDB.putItem({
    TableName: 'GuessGameTable',
    Item: {
      PK: `INSTRUMENT#${priceUpdate.instrument}`,
      SK: `TIMESTAMP#${Date.now()}`,
      price: priceUpdate.price
    }
  });
});

// Lambda (createGuess, resolveGuess)
// No external API calls - just read from DynamoDB
const price = await getLatestInstrumentPrice(instrument);
```

**Benefits:**
- Eliminates price fetch latency in Lambda (no CoinGecko API calls)
- Reduces SQS retries due to missing price data (fixes Issue #1)
- Enables sub-second price granularity (useful if guess resolution time decreases)
- Single source of truth for all price data

**Cost Estimate:**
- Fargate (0.25 vCPU, 0.5 GB): ~$15-20/month (24/7 runtime)
- DynamoDB writes (1 write/5 seconds = 17,280/day): ~$2/month
- Total: ~$17-22/month (vs current near-zero Lambda cost)

**When to Implement:**
- User traffic justifies continuous price updates (>1,000 guesses/day)
- Guess resolution time reduced to <10 seconds (needs real-time prices)
- Multi-instrument support deployed (Fargate handles multiple WebSocket streams)

**CDK Stack:**
```typescript
// lib/stacks/fargate-stack.ts (new)
const fargateTask = new ecs.FargateTaskDefinition(this, 'PriceFetcherTask', {
  cpu: 256,
  memoryLimitMiB: 512
});

fargateTask.addContainer('PriceFetcher', {
  image: ecs.ContainerImage.fromAsset('../fargate-price-fetcher'),
  environment: {
    TABLE_NAME: databaseStack.table.tableName
  }
});
```

---

### 5b. Multi-Instrument Support

**Current State:**
- GraphQL schema already supports `instrument: String!` field in `Guess` type
- [createGuess/index.ts:63](./backend/lambdas/createGuess/index.ts#L63) hardcodes `instrument = 'BTCUSD'`
- DynamoDB single-table design supports `INSTRUMENT#<instrument>` partition key

**Implementation (Minimal Changes Required):**

1. **Update GraphQL Schema:**
```graphql
# schema/schema.graphql
type Mutation {
  createGuess(
    direction: Direction!
    instrument: String = "BTCUSD"  # Add optional instrument parameter
  ): Guess @aws_cognito_user_pools
}
```

2. **Update createGuess Lambda:**
```typescript
// lambdas/createGuess/index.ts
const { direction, instrument = 'BTCUSD' } = event.arguments;

// Remove hardcoded line 63
// const instrument = 'BTCUSD';  // DELETE THIS
```

3. **Frontend UI:**
```svelte
<!-- Add instrument selector in frontend -->
<select bind:value={selectedInstrument}>
  <option value="BTCUSD">Bitcoin (BTC)</option>
  <option value="ETHUSD">Ethereum (ETH)</option>
  <option value="DOGEUSD">Dogecoin (DOGE)</option>
</select>
```

**Benefits:**
- Increased user engagement (more guessing options)
- No DynamoDB schema changes needed (already supports instruments)
- Easy to add new instruments (just update UI options)

**Dependencies:**
- Ideally implemented with 5a (Fargate price fetcher) for scalability
- Without 5a: Multiple CoinGecko API calls per guess (slower, rate limit risk)

**Priority:** Low (unless user demand exists). Infrastructure is ready, just needs parameter exposure.

---

### 5c. AWS X-Ray Integration

**Implementation:**

1. **Add X-Ray SDK to Lambdas:**
```typescript
// lambdas/createGuess/index.ts
import AWSXRay from 'aws-xray-sdk-core';
const AWS = AWSXRay.captureAWS(require('@aws-sdk/client-dynamodb'));

export const handler = async (event) => {
  const segment = AWSXRay.getSegment();
  segment.addAnnotation('guessId', guessId);
  segment.addAnnotation('userId', userId);
  // ... rest of handler
};
```

2. **Enable Tracing in CDK:**
```typescript
// lib/stacks/compute-stack.ts
new lambda.Function(this, 'CreateGuessFunction', {
  tracing: lambda.Tracing.ACTIVE,  // Enable X-Ray
  // ...
});
```

3. **Add SQS Message Trace Propagation:**
```typescript
// createGuess: propagate trace ID to SQS
await sqsClient.send(new SendMessageCommand({
  QueueUrl: QUEUE_URL,
  MessageBody: messageBody,
  MessageAttributes: {
    'AWSTraceHeader': {
      StringValue: process.env._X_AMZN_TRACE_ID,
      DataType: 'String'
    }
  }
}));
```

**Benefits:**
- Visual service map: API Gateway → Lambda → DynamoDB → SQS → Lambda → AppSync
- End-to-end latency tracking for each guess (see full 60-second resolution flow)
- Identify bottlenecks (e.g., DynamoDB query latency, SQS requeue frequency)
- Correlate errors across services (e.g., SQS requeue → DynamoDB throttle)

**Cost:**
- X-Ray: $5 per million traces (likely <$1/month for current traffic)
- First 100,000 traces/month free

**When to Implement:**
- **Next priority** (high value, low cost)
- Before scaling to higher traffic
- When debugging production issues (requeue loops, timeout errors)

**Example Use Case:**
```
X-Ray Service Map:
AppSync (createGuess)
  └─> Lambda (createGuess) [120ms]
      ├─> DynamoDB (PutItem) [15ms]
      └─> SQS (SendMessage) [8ms]
          └─> Lambda (resolveGuess) [60s delay]
              ├─> DynamoDB (Query) [12ms]
              └─> AppSync (updateGuessStatus) [18ms]

Trace shows: 60.2 seconds total (60s SQS delay + 200ms processing)
```

---

### 5d. Frontend Component Tests

**Current State:**
- No component tests (only TypeScript type checking with `npm run check`)
- Manual testing for UI interactions and Svelte 5 reactivity

**Proposed Testing Stack:**
```bash
cd frontend
npm install -D vitest @testing-library/svelte @testing-library/jest-dom jsdom
```

**Test Coverage:**

1. **Components:**
```typescript
// src/lib/components/ActiveGuess.test.ts
import { render, screen } from '@testing-library/svelte';
import ActiveGuess from './ActiveGuess.svelte';

test('displays countdown timer for active guess', () => {
  const guess = { startTime: Date.now(), resolved: false };
  render(ActiveGuess, { guess });
  expect(screen.getByText(/59s/)).toBeInTheDocument();
});
```

2. **Stores:**
```typescript
// src/lib/stores/game.svelte.test.ts
import { GameStore } from './game.svelte';

test('createGuess updates activeGuess state', async () => {
  const store = new GameStore();
  await store.createGuess('up');
  expect(store.activeGuess).toBeTruthy();
  expect(store.activeGuess.direction).toBe('up');
});
```

3. **GraphQL Integration:**
```typescript
// src/lib/graphql-client.test.ts
import { graphqlClient } from './graphql-client';

test('subscription receives guess updates', async () => {
  const subscription = graphqlClient.subscribe(/* ... */);
  // Mock AppSync response, verify store update
});
```

**Benefits:**
- Catch regressions before deployment (e.g., countdown timer breaks)
- Faster iteration (no manual testing cycle)
- Confidence in Svelte 5 reactivity behavior (runes, `$state`, `$derived`)
- Documentation via tests (shows intended component behavior)

**Priority:** Medium (no critical bugs currently, but would improve developer velocity)

**When to Implement:**
- Before major UI refactoring
- Before adding new game modes (e.g., multi-instrument, leaderboards)
- When onboarding new frontend developers

---

## Implementation Priority

| Improvement | Priority | Cost | Complexity | Estimated Effort | When to Implement |
|-------------|----------|------|------------|------------------|-------------------|
| **5c. X-Ray Tracing** | **High** | Low (~$1/month) | Low | 2-3 hours | **Next** (debugging/optimization) |
| **5d. Frontend Tests** | Medium | None | Medium | 1-2 days | Before major UI changes |
| **5b. Multi-Instrument** | Low | Low | Low | 2-3 hours | If user demand exists (UI change only) |
| **5a. Fargate Price Fetcher** | Low | High (~$20/month) | High | 3-5 days | Only if traffic scales significantly |

---

## Related Documentation

- [DEVELOPMENT.md](./backend/DEVELOPMENT.md) - Backend development guide
- [frontend/DEVELOPMENT.md](./frontend/DEVELOPMENT.md) - Frontend development guide
- [CLAUDE.md](./CLAUDE.md) - Quick reference for AI-assisted development
- [README.md](./README.md) - Project overview and deployment

---

## Conclusion

The current architecture (AppSync + SQS + Lambda + DynamoDB) strikes a good balance between **cost, simplicity, and scalability** for the current use case (low-to-medium traffic guessing game).

**Key Decisions:**
- **AppSync over API Gateway**: Real-time subscriptions are the killer feature (eliminates polling)
- **SQS over Step Functions/EventBridge**: 75x cheaper, simpler for delay-and-retry pattern
- **On-demand price fetching over Fargate**: Near-zero cost vs $20/month (not justified at current scale)

**Next Steps:**
1. **Add X-Ray tracing** (5c) for better observability (high value, low cost)
2. **Add frontend component tests** (5d) to prevent regressions
3. Monitor traffic and revisit Fargate price fetcher (5a) if resolution time becomes critical

For questions or proposed changes, see [DEVELOPMENT.md#troubleshooting](./backend/DEVELOPMENT.md#troubleshooting).
