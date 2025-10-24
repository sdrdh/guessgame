# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bitcoin price guessing game: Players predict if Bitcoin price will go UP or DOWN, wait 60 seconds for resolution, and earn points for correct guesses. Built with SvelteKit frontend and AWS serverless backend.

**Architecture**: See [README.md](README.md) for detailed overview and deployment instructions.

## Essential Documentation

- **[README.md](README.md)** - Project overview, features, deployment, CloudFlare setup, and usage
- **[backend/DEVELOPMENT.md](backend/DEVELOPMENT.md)** - Complete backend development guide (CDK, Lambda, DynamoDB, GraphQL)
- **[frontend/DEVELOPMENT.md](frontend/DEVELOPMENT.md)** - Complete frontend development guide (Svelte 5, state management, GraphQL integration)

## Quick Commands

### Development
```bash
# Backend
cd backend
npm test                  # Run all 52 tests
npm run deploy            # Deploy all stacks + frontend

# Frontend
cd frontend
npm run dev               # Dev server on port 5173
npm run check             # Type checking
```

### Testing
```bash
cd backend
npm test -- -t "pattern"  # Run specific test
```

## Architecture Quick Reference

> **📊 Architecture Diagram**: See [architecture.png](architecture.png)

### Stack Dependencies (Critical!)

**Deployment order** (defined in [backend/bin/app.ts](backend/bin/app.ts)):
```
DatabaseStack + QueueStack → ComputeStack → AuthStack → ApiStack → IntegrationStack
FrontendStack (independent)
```

**Why order matters**: ComputeStack creates postConfirmation Lambda that AuthStack needs for Cognito trigger.

Full details: [backend/DEVELOPMENT.md#multi-stack-architecture](backend/DEVELOPMENT.md#multi-stack-architecture)

### Single-Table DynamoDB

All entities in one table with composite PK/SK:
- User: `PK: USER#<userId>`, `SK: PROFILE`
- Guess: `PK: USER#<userId>`, `SK: GUESS#<timestamp>`
- Price: `PK: INSTRUMENT#<instrument>`, `SK: TIMESTAMP#<timestamp>`

Full details: [backend/DEVELOPMENT.md#dynamodb-single-table-design](backend/DEVELOPMENT.md#dynamodb-single-table-design)

### Lambda Functions

**AppSync resolvers**: createGuess, resolveGuess, getUser, getGuessHistory
**Event-driven**: postConfirmation (Cognito), streamProcessor (DynamoDB Streams)
**Shared code**: [backend/lambdas/shared/](backend/lambdas/shared/) (db.ts, instrumentPrice.ts)

Full details: [backend/DEVELOPMENT.md#lambda-functions](backend/DEVELOPMENT.md#lambda-functions)

### Svelte 5 State Management

**Stores** (Svelte 5 runes, not Svelte 4 contracts):
- [frontend/src/lib/stores/auth.svelte.ts](frontend/src/lib/stores/auth.svelte.ts) - Cognito authentication
- [frontend/src/lib/stores/game.svelte.ts](frontend/src/lib/stores/game.svelte.ts) - Game state + GraphQL subscriptions

**Pattern**: Class-based stores with `$state`, getters for computed values, manual lifecycle methods.

Full details: [frontend/DEVELOPMENT.md#svelte-5-reactivity](frontend/DEVELOPMENT.md#svelte-5-reactivity)

## Key Technical Patterns

### SQS Retry Pattern (Critical!)

`resolveGuess` **requeues messages** instead of internal retry loops:
- Receives message from SQS (60s delay)
- If price not available or unchanged → **requeue with 5s delay**
- If price changed → resolve guess and update score

Why: Avoids Lambda timeouts, leverages SQS durability.

Full details: [backend/DEVELOPMENT.md#2-resolveguess](backend/DEVELOPMENT.md#2-resolveguess)

### Price Caching Strategy

All price fetches go through [backend/lambdas/shared/instrumentPrice.ts](backend/lambdas/shared/instrumentPrice.ts):
- Cache-first: Check DynamoDB for price < 5s old
- On miss: Fetch from Coinbase and store in DynamoDB
- Historical lookup: Range queries on timestamp-based SK

Benefits: Reduces API calls, enables concurrent guess resolution.

Full details: [backend/DEVELOPMENT.md#price-fetching-and-caching](backend/DEVELOPMENT.md#price-fetching-and-caching)

### Real-time Updates Flow

1. `resolveGuess` updates DynamoDB guess record
2. DynamoDB Streams triggers `streamProcessor` Lambda
3. `streamProcessor` calls AppSync mutation `updateGuessStatus`
4. AppSync pushes update to subscribed clients via `onGuessUpdated`
5. Frontend receives update and updates UI

**Why separate?** Decouples business logic from UI updates, streamProcessor handles all AppSync calls.

Full details: [backend/DEVELOPMENT.md#6-streamprocessor](backend/DEVELOPMENT.md#6-streamprocessor)

### Dual Price Updates (Frontend)

Frontend receives prices from **two sources**:
1. **Coinbase direct** (every 15s) - Baseline, ensures price always loads
2. **AppSync subscription** (real-time) - Pushed from backend, lower latency

**Why both?** AppSync updates only fire when backend updates prices (during guess creation/resolution by any user). Without Coinbase polling, users might see no price at all when trying to create a guess if no one else is actively playing. Coinbase ensures the price always displays, while AppSync provides real-time updates when available. This also enables future price charts via WebSocket data.

Full details: [frontend/DEVELOPMENT.md#dual-price-updates](frontend/DEVELOPMENT.md#dual-price-updates)

## Common Workflows

### Adding a Lambda Function

See: [backend/DEVELOPMENT.md#adding-a-new-lambda-function](backend/DEVELOPMENT.md#adding-a-new-lambda-function)

### Modifying GraphQL Schema

1. Edit [backend/schema/schema.graphql](backend/schema/schema.graphql)
2. Update Lambda types + validation
3. Update [frontend/src/lib/graphql-client.ts](frontend/src/lib/graphql-client.ts)
4. Deploy: `cd backend && npm run deploy`

Full details: [backend/DEVELOPMENT.md#modifying-graphql-schema](backend/DEVELOPMENT.md#modifying-graphql-schema)

### Frontend After Backend Deploy

1. Deploy backend: `cd backend && npm run deploy`
2. Copy CDK outputs (UserPoolId, GraphQL endpoint, etc.)
3. Update [frontend/src/lib/aws-config.ts](frontend/src/lib/aws-config.ts)
4. Redeploy frontend: `cd backend && npm run deploy:frontend`

Full details: [frontend/DEVELOPMENT.md#aws-configuration](frontend/DEVELOPMENT.md#aws-configuration)

## File Structure

### Backend
```
backend/
├── bin/app.ts               # Stack orchestration + dependencies
├── lib/stacks/              # CDK stack definitions (7 stacks)
├── lambdas/                 # Lambda function handlers
│   ├── shared/              # Shared utilities (db.ts, instrumentPrice.ts)
│   └── [function]/index.ts
└── schema/schema.graphql    # AppSync schema
```

### Frontend
```
frontend/
├── src/
│   ├── lib/
│   │   ├── stores/          # Svelte 5 state stores
│   │   ├── components/      # Reusable components + shadcn-svelte UI
│   │   ├── graphql-client.ts
│   │   └── aws-config.ts
│   └── routes/              # SvelteKit pages
```

## Troubleshooting

**Backend issues**: [backend/DEVELOPMENT.md#troubleshooting](backend/DEVELOPMENT.md#troubleshooting)
**Frontend issues**: [frontend/DEVELOPMENT.md#troubleshooting](frontend/DEVELOPMENT.md#troubleshooting)

## Architecture Decisions

**Why SQS instead of EventBridge?** [backend/DEVELOPMENT.md#why-sqs-instead-of-eventbridge-scheduler](backend/DEVELOPMENT.md#why-sqs-instead-of-eventbridge-scheduler)
**Why single table?** [backend/DEVELOPMENT.md#why-single-table-instead-of-multiple-tables](backend/DEVELOPMENT.md#why-single-table-instead-of-multiple-tables)
**Why Svelte 5?** [frontend/DEVELOPMENT.md#why-svelte-5-instead-of-react](frontend/DEVELOPMENT.md#why-svelte-5-instead-of-react)
**Why dual price updates?** AppSync only updates when backend fetches prices (during active gameplay). Coinbase polling ensures prices always display, even during low activity. WebSocket subscriptions also enable future features like live price charts. See: [frontend/DEVELOPMENT.md#dual-price-updates](frontend/DEVELOPMENT.md#dual-price-updates)
