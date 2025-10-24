# Frontend Development Guide

SvelteKit app with Svelte 5, AppSync GraphQL, and Cognito auth.

## Quick Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server (port 5173)
npm run build        # Production build
npm run check        # Type checking
```

## Tech Stack

- **Framework**: SvelteKit 2 + Svelte 5
- **Styling**: Tailwind CSS v4 + shadcn-svelte
- **Auth**: AWS Amplify (Cognito)
- **API**: GraphQL (AWS AppSync)
- **Deployment**: Static adapter → S3

## Svelte 5 State Management

### Runes-Based Stores

Class-based stores with Svelte 5 runes (NOT Svelte 4 `writable()`):

```typescript
class GameStore {
  user = $state<User | null>(null);          // Reactive state
  currentPrice = $state<number>(0);

  get activeGuess() {                         // Computed value
    return this.user?.activeGuess || null;
  }
}

export const gameStore = new GameStore();    // Singleton
```

**Usage**:
```svelte
<script>
  import { gameStore } from '$lib/stores/game.svelte';
  const price = gameStore.currentPrice;  // Auto-reactive
</script>
```

### Stores

**[stores/auth.svelte.ts](src/lib/stores/auth.svelte.ts)**:
- `isAuthenticated`, `user`, `isLoading`
- Methods: `checkAuth()`, `signOut()`

**[stores/game.svelte.ts](src/lib/stores/game.svelte.ts)**:
- `user`, `currentPrice`, `guessHistory`
- Computed: `activeGuess`, `hasActiveGuess`, `timeUntilResolution`
- Methods: `init()`, `makeGuess()`, `cleanup()`
- GraphQL subscriptions for real-time updates

## GraphQL Integration

### Client Setup

[graphql-client.ts](src/lib/graphql-client.ts) - Lazy-loaded client:

```typescript
const graphqlClient = generateClient();  // After Amplify configured
```

### Operations

**Queries**: `getUser`, `getGuessHistory`
**Mutations**: `createGuess`
**Subscriptions**: `onGuessUpdated`, `onPriceUpdated`

**Example**:
```typescript
await graphqlClient.graphql({
  query: mutations.createGuess,
  variables: { direction: Direction.UP }
});
```

### Subscriptions

Real-time updates via AppSync:

```typescript
graphqlClient.graphql({
  query: subscriptions.onGuessUpdated,
  variables: { userId }
}).subscribe({
  next: (response) => {
    const updatedGuess = response.data.onGuessUpdated;
    // Update UI
  }
});
```

## Dual Price Updates

Frontend gets prices from **two sources**:

1. **Coinbase direct** (every 15s) - Baseline, ensures price always loads
2. **AppSync subscription** (real-time) - Low latency when available

**Why both?**
- AppSync `onPriceUpdated` only fires when backend updates prices (during guess creation/resolution by any user)
- If no one is actively playing, AppSync may never push updates, leaving the UI with no price data
- Coinbase polling ensures prices always display, even during low activity
- AppSync provides real-time updates when users are actively playing
- WebSocket subscription enables future features like live price charts

## AWS Configuration

After backend deploy, update [src/lib/aws-config.ts](src/lib/aws-config.ts):

```typescript
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'COPY_FROM_CDK_OUTPUT',
      userPoolClientId: 'COPY_FROM_CDK_OUTPUT'
    }
  },
  API: {
    GraphQL: {
      endpoint: 'COPY_FROM_CDK_OUTPUT',
      defaultAuthMode: 'userPool'
    }
  }
});
```

## Component Structure

```
src/
├── routes/
│   ├── +layout.svelte        # Auth check, Amplify config
│   ├── +page.svelte          # Main game page
│   ├── login/+page.svelte    # Login/register
│   └── verify/+page.svelte   # Email verification
├── lib/
│   ├── components/
│   │   ├── Header.svelte
│   │   ├── PriceDisplay.svelte
│   │   ├── ActiveGuess.svelte
│   │   ├── GuessButtons.svelte
│   │   ├── GuessHistory.svelte
│   │   └── ui/               # shadcn-svelte
│   ├── stores/
│   ├── graphql-client.ts
│   └── aws-config.ts
```

## Authentication Flow

1. **Register**: `signUp()` → Email verification code sent
2. **Verify**: `confirmSignUp()` → postConfirmation Lambda creates user
3. **Login**: `signIn()` → JWT token stored
4. **Game**: Frontend → AppSync (with JWT)

## Common Tasks

### Add GraphQL Operation

1. Update backend schema
2. Add to `graphql-client.ts`:
   ```typescript
   export const queries = {
     myQuery: `query MyQuery { ... }`
   };
   ```
3. Add TypeScript interface
4. Use in component/store

### Add Component

1. Create `lib/components/MyComponent.svelte`
2. Define props:
   ```svelte
   <script lang="ts">
     export let title: string;
   </script>
   ```
3. Import and use in parent

### Update After Backend Changes

1. Deploy backend
2. Update `aws-config.ts` with CDK outputs
3. Redeploy: `cd backend && npm run deploy:frontend`

## Troubleshooting

**Amplify not configured**: Check `aws-config.ts` and `+layout.svelte`
**GraphQL unauthorized**: Verify JWT token and auth mode
**Subscriptions not working**:
  - Check AppSync endpoint and credentials
  - Verify mutation response fields match subscription filter fields
  - Ensure filtered attributes are defined in both the subscription schema and mutation response type (e.g., if filtering by `userId`, it must be in the mutation's return type)
  - Check browser console for WebSocket connection errors
**Price stuck**: Check Coinbase API accessibility
