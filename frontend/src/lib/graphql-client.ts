import { generateClient } from 'aws-amplify/api';

// Lazy-load the GraphQL client after Amplify is configured
let _graphqlClient: any = null;

export function getGraphQLClient() {
  if (!_graphqlClient) {
    _graphqlClient = generateClient();
  }
  return _graphqlClient;
}

// For backward compatibility, export as graphqlClient
export const graphqlClient = {
  graphql: (...args: any[]) => getGraphQLClient().graphql(...args)
};

// GraphQL Queries
export const queries = {
  getUser: /* GraphQL */ `
    query GetUser {
      getUser {
        userId
        email
        score
        activeGuess {
          guessId
          userId
          instrument
          direction
          startPrice
          startTime
          resolved
          endPrice
          correct
          scoreChange
          resolvedAt
        }
        createdAt
        updatedAt
      }
    }
  `,

  getGuessHistory: /* GraphQL */ `
    query GetGuessHistory($limit: Int) {
      getGuessHistory(limit: $limit) {
        guessId
        userId
        instrument
        direction
        startPrice
        startTime
        resolved
        endPrice
        correct
        scoreChange
        resolvedAt
      }
    }
  `
};

// GraphQL Mutations
export const mutations = {
  createGuess: /* GraphQL */ `
    mutation CreateGuess($direction: Direction!) {
      createGuess(direction: $direction) {
        guessId
        userId
        instrument
        direction
        startPrice
        startTime
        resolved
        endPrice
        correct
        scoreChange
        resolvedAt
      }
    }
  `
};

// GraphQL Subscriptions
export const subscriptions = {
  onGuessUpdated: /* GraphQL */ `
    subscription OnGuessUpdated($userId: ID!) {
      onGuessUpdated(userId: $userId) {
        guessId
        userId
        instrument
        direction
        startPrice
        startTime
        resolved
        endPrice
        correct
        scoreChange
        resolvedAt
      }
    }
  `,

  onPriceUpdated: /* GraphQL */ `
    subscription OnPriceUpdated($instrument: String!) {
      onPriceUpdated(instrument: $instrument) {
        instrument
        price
        timestamp
      }
    }
  `
};

// Type definitions for TypeScript
export enum Direction {
  UP = 'up',
  DOWN = 'down'
}

export interface Guess {
  guessId: string;
  userId: string;
  instrument: string;
  direction: Direction;
  startPrice: number;
  startTime: number;
  resolved: boolean;
  endPrice?: number;
  correct?: boolean;
  scoreChange?: number;
  resolvedAt?: number;
}

export interface User {
  userId: string;
  email: string;
  score: number;
  activeGuess?: Guess;
  createdAt: number;
  updatedAt: number;
}

export interface Price {
  instrument: string;
  price: number;
  timestamp: number;
}
