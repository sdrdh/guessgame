import { AppSyncResolverEvent } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { getUser, getActiveGuess, createGuess } from '../shared/db';
import { getCurrentInstrumentPrice } from '../shared/instrumentPrice';
import { randomUUID } from 'crypto';

const sqsClient = new SQSClient({});
const QUEUE_URL = process.env.QUEUE_URL!;
const GUESS_DELAY = 60; // seconds

interface CreateGuessInput {
  direction: 'up' | 'down';
}

interface Guess {
  guessId: string;
  userId: string;
  instrument: string;
  direction: 'up' | 'down';
  startPrice: number;
  startTime: number;
  resolved: boolean;
  endPrice?: number;
  correct?: boolean;
  scoreChange?: number;
  resolvedAt?: number;
}

export const handler = async (event: AppSyncResolverEvent<CreateGuessInput>): Promise<Guess> => {
  console.log('createGuess event:', JSON.stringify(event, null, 2));

  // Get userId from Cognito token
  const identity = event.identity as any;
  const userId = identity?.claims?.sub;
  if (!userId) {
    throw new Error('Unauthorized: No user ID in token');
  }

  const { direction } = event.arguments;

  // Validate input
  if (!direction || !['up', 'down'].includes(direction)) {
    throw new Error('Invalid direction. Must be "up" or "down"');
  }

  try {
    // Verify user exists (should be created by Cognito post-confirmation trigger)
    const user = await getUser(userId);
    if (!user) {
      console.error('❌ User not found in database:', userId);
      throw new Error('User profile not found. Please contact support.');
    }

    console.log(`✅ User verified: ${user.email}`);

    // Check for active guess
    const activeGuess = await getActiveGuess(userId);
    if (activeGuess) {
      throw new Error('You already have an active guess. Wait for it to resolve before making another guess.');
    }

    // Default to BTCUSD for now
    const instrument = 'BTCUSD';

    // Get current BTC price
    console.log(`Fetching current ${instrument} price...`);
    const currentPrice = await getCurrentInstrumentPrice(instrument);
    console.log(`Current ${instrument} price: $${currentPrice}`);

    // Create guess object
    const guess: Guess = {
      guessId: randomUUID(),
      userId,
      instrument,
      direction,
      startPrice: currentPrice,
      startTime: Date.now(),
      resolved: false
    };

    // Store guess in DynamoDB
    await createGuess(userId, guess);
    console.log(`Guess created: ${guess.guessId}`);

    // Send message to SQS with delay
    const messageBody = JSON.stringify({
      userId,
      guessId: guess.guessId,
      instrument: guess.instrument,
      direction: guess.direction,
      startPrice: guess.startPrice,
      startTime: guess.startTime
    });

    await sqsClient.send(new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: messageBody,
      DelaySeconds: GUESS_DELAY
    }));

    console.log(`Queued guess resolution for ${GUESS_DELAY} seconds`);

    return guess;
  } catch (error) {
    console.error('Error creating guess:', error);
    throw error;
  }
};
