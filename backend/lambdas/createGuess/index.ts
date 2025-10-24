import { AppSyncResolverEvent } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { getUser, getActiveGuess, createGuess } from '../shared/db';
import { getCurrentInstrumentPrice } from '../shared/instrumentPrice';
import { randomUUID } from 'crypto';
import { logger, tracer, wrapHandler } from '../shared/powertools';

const sqsClient = tracer.captureAWSv3Client(new SQSClient({}));
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

const lambdaHandler = async (event: AppSyncResolverEvent<CreateGuessInput>): Promise<Guess> => {
  logger.debug('createGuess event received', { eventType: event.info.fieldName });

  // Get userId from Cognito token
  const identity = event.identity as any;
  const userId = identity?.claims?.sub;
  if (!userId) {
    throw new Error('Unauthorized: No user ID in token');
  }

  // Add userId to all subsequent logs
  logger.appendKeys({ userId });
  tracer.putAnnotation('userId', userId);

  const { direction } = event.arguments;

  // Validate input
  if (!direction || !['up', 'down'].includes(direction)) {
    throw new Error('Invalid direction. Must be "up" or "down"');
  }

  tracer.putAnnotation('direction', direction);

  try {
    // Verify user exists (should be created by Cognito post-confirmation trigger)
    const user = await getUser(userId);
    if (!user) {
      logger.error('User not found in database', { userId });
      throw new Error('User profile not found. Please contact support.');
    }

    logger.info('User verified', { userId, score: user.score });

    // Check for active guess
    const activeGuess = await getActiveGuess(userId);
    if (activeGuess) {
      throw new Error('You already have an active guess. Wait for it to resolve before making another guess.');
    }

    // Default to BTCUSD for now
    const instrument = 'BTCUSD';
    tracer.putAnnotation('instrument', instrument);

    // Get current BTC price
    logger.info('Fetching current instrument price', { instrument });
    const currentPrice = await getCurrentInstrumentPrice(instrument);
    logger.info('Current instrument price fetched', { instrument, price: currentPrice });

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

    // Add guessId to logs and traces
    logger.appendKeys({ guessId: guess.guessId });
    tracer.putAnnotation('guessId', guess.guessId);
    tracer.putMetadata('guess', {
      instrument,
      direction,
      startPrice: currentPrice,
      startTime: guess.startTime
    });

    // Store guess in DynamoDB
    await createGuess(userId, guess);
    logger.info('Guess created successfully', { guessId: guess.guessId });

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

    logger.info('Guess queued for resolution', { guessId: guess.guessId, delaySeconds: GUESS_DELAY });

    return guess;
  } catch (error) {
    logger.error('Error creating guess', error as Error);
    throw error;
  }
};

export const handler = wrapHandler(lambdaHandler);
