import { graphqlClient, queries, mutations, subscriptions, type User, type Guess, type Price, Direction } from '$lib/graphql-client';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';

// Game state using Svelte 5 runes
class GameStore {
  user = $state<User | null>(null);
  currentPrice = $state<number>(0);
  priceTimestamp = $state<number>(0);
  guessHistory = $state<Guess[]>([]);
  isLoading = $state<boolean>(false);
  error = $state<string | null>(null);
  currentTime = $state<number>(Math.floor(Date.now() / 1000));

  // Subscription handlers
  private guessSubscription: any = null;
  private priceSubscription: any = null;
  private timeInterval: any = null;

  // Computed values using $derived
  get activeGuess() {
    return this.user?.activeGuess;
  }

  get hasActiveGuess() {
    return !!this.activeGuess && !this.activeGuess.resolved;
  }

  get score() {
    return this.user?.score ?? 0;
  }

  get timeUntilResolution() {
    if (!this.activeGuess || this.activeGuess.resolved) {
      return null;
    }

    // startTime is a Unix timestamp in seconds (AWSTimestamp)
    // If it's in milliseconds, convert to seconds
    const startTimeSeconds = this.activeGuess.startTime > 10000000000
      ? Math.floor(this.activeGuess.startTime / 1000)
      : this.activeGuess.startTime;

    const resolutionTime = startTimeSeconds + 60; // 60 seconds after start
    const secondsRemaining = resolutionTime - this.currentTime;

    if (secondsRemaining <= 0) {
      return 'Resolving...';
    }

    return `Resolving in ${secondsRemaining}s`;
  }

  get priceLastUpdated() {
    if (!this.priceTimestamp) {
      return null;
    }

    const secondsAgo = this.currentTime - this.priceTimestamp;

    if (secondsAgo < 5) {
      return 'Just now';
    } else if (secondsAgo < 60) {
      return `${secondsAgo} seconds ago`;
    } else {
      const minutesAgo = Math.floor(secondsAgo / 60);
      return `${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago`;
    }
  }

  // Initialize store and load user data
  async init() {
    try {
      this.isLoading = true;
      this.error = null;

      console.log('Initializing game store...');

      // Start time interval for countdown updates
      this.startTimeInterval();

      // Load user profile (won't throw, just sets error if fails)
      await this.loadUser();

      // Subscribe to real-time updates if user is loaded
      if (this.user) {
        console.log('User loaded, setting up subscriptions...');
        this.subscribeToGuessUpdates();
        this.subscribeToPriceUpdates();

        // Load guess history only if user exists
        await this.loadGuessHistory();
      } else {
        console.warn('User not loaded, skipping subscriptions and history');
      }

      console.log('Game store initialized');
    } catch (err: any) {
      console.error('Failed to initialize game store:', err);
      this.error = err.message || 'Failed to initialize game';
    } finally {
      this.isLoading = false;
    }
  }

  // Start interval to update current time every second
  private startTimeInterval() {
    if (typeof window === 'undefined') return;

    this.timeInterval = setInterval(() => {
      this.currentTime = Math.floor(Date.now() / 1000);
    }, 1000);
  }

  // Load user profile from backend
  async loadUser() {
    try {
      const response = await graphqlClient.graphql({
        query: queries.getUser
      });

      this.user = response.data.getUser as User;
      console.log('User loaded successfully:', this.user);
    } catch (err: any) {
      console.error('Failed to load user - Full error:', err);
      console.error('Error message:', err.message);
      console.error('Error errors:', err.errors);

      // Don't throw - just log the error and continue
      // This allows the app to still load even if user fetch fails
      this.error = `Failed to load user profile: ${err.message || 'Unknown error'}`;
    }
  }

  // Load guess history
  async loadGuessHistory(limit: number = 10) {
    try {
      console.log(`Loading guess history (limit: ${limit})...`);
      const response = await graphqlClient.graphql({
        query: queries.getGuessHistory,
        variables: { limit }
      });

      console.log('Guess history response:', response);
      this.guessHistory = (response.data.getGuessHistory || []) as Guess[];
      console.log(`Loaded ${this.guessHistory.length} historical guesses`);
    } catch (err: any) {
      console.error('Failed to load guess history - Full error:', err);
      console.error('Error details:', err.errors);
    }
  }

  // Make a new guess
  async makeGuess(direction: 'up' | 'down') {
    if (this.hasActiveGuess) {
      this.error = 'You already have an active guess';
      return;
    }

    try {
      this.isLoading = true;
      this.error = null;

      const response = await graphqlClient.graphql({
        query: mutations.createGuess,
        variables: {
          direction: direction === 'up' ? Direction.UP : Direction.DOWN
        }
      });

      const newGuess = response.data.createGuess as Guess;

      // Update user's active guess
      if (this.user) {
        this.user.activeGuess = newGuess;
      }

      console.log('Guess created:', newGuess);
    } catch (err: any) {
      console.error('Failed to create guess:', err);
      this.error = err.message || 'Failed to create guess';
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  // Subscribe to guess updates for current user
  private subscribeToGuessUpdates() {
    if (!this.user?.userId) {
      console.warn('Cannot subscribe: no userId');
      return;
    }

    try {
      console.log(`🔔 Subscribing to guess updates for user: ${this.user.userId}`);

      this.guessSubscription = graphqlClient.graphql({
        query: subscriptions.onGuessUpdated,
        variables: { userId: this.user.userId }
      }).subscribe({
        next: (response: any) => {
          console.log('📨 Raw subscription data received:', JSON.stringify(response, null, 2));
          const updatedGuess = response.data?.onGuessUpdated as Guess;
          console.log('✅ Parsed guess update:', updatedGuess);

          // Update active guess
          if (this.user?.activeGuess?.guessId === updatedGuess.guessId) {
            this.user.activeGuess = updatedGuess;

            // If guess is resolved, update score and add to history
            if (updatedGuess.resolved) {
              if (updatedGuess.scoreChange) {
                this.user.score += updatedGuess.scoreChange;
              }

              // Add to history
              this.guessHistory = [updatedGuess, ...this.guessHistory];

              // Clear active guess
              this.user.activeGuess = undefined;
            }
          }
        },
        error: (err: any) => {
          console.error('❌ Guess subscription error:', err);
          console.error('Error details:', JSON.stringify(err, null, 2));
        },
        complete: () => {
          console.log('🔴 Guess subscription completed (connection closed)');
        }
      });

      console.log('✅ Subscription established');
    } catch (err) {
      console.error('❌ Failed to subscribe to guess updates:', err);
    }
  }

  // Subscribe to BTC price updates
  private subscribeToPriceUpdates() {
    try {
      console.log('Subscribing to price updates for: BTCUSD');
      this.priceSubscription = graphqlClient.graphql({
        query: subscriptions.onPriceUpdated,
        variables: { instrument: 'BTCUSD' }
      }).subscribe({
        next: (response: any) => {
          const priceUpdate = response.data.onPriceUpdated as Price;
          console.log('✅ Price subscription received update:', priceUpdate);
          this.currentPrice = priceUpdate.price;
          this.priceTimestamp = priceUpdate.timestamp;
        },
        error: (err: any) => {
          console.error('Price subscription error:', err);
        }
      });
    } catch (err) {
      console.error('Failed to subscribe to price updates:', err);
    }
  }

  // Cleanup subscriptions
  cleanup() {
    if (this.guessSubscription) {
      this.guessSubscription.unsubscribe();
      this.guessSubscription = null;
    }
    if (this.priceSubscription) {
      this.priceSubscription.unsubscribe();
      this.priceSubscription = null;
    }
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
  }

  // Reset store
  reset() {
    this.cleanup();
    this.user = null;
    this.currentPrice = 0;
    this.guessHistory = [];
    this.isLoading = false;
    this.error = null;
  }
}

// Export singleton instance
export const gameStore = new GameStore();
