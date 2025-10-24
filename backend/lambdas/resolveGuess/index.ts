import { SQSEvent } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { updateUserScore, resolveGuess } from '../shared/db';
import { getCurrentInstrumentPrice, findDifferentPriceAfter } from '../shared/instrumentPrice';
import { logger, tracer, wrapHandler } from '../shared/powertools';

const sqsClient = tracer.captureAWSv3Client(new SQSClient({}));
const QUEUE_URL = process.env.QUEUE_URL!;
const MAX_RETRIES = 6; // Max retries if price unchanged
const RETRY_DELAY = 10; // seconds
const MIN_TIME_ELAPSED = 60000; // 60 seconds in milliseconds

interface GuessMessage {
  userId: string;
  guessId: string;
  instrument: string;
  direction: 'up' | 'down';
  startPrice: number;
  startTime: number;
  retryCount?: number;
}

const lambdaHandler = async (event: SQSEvent): Promise<void> => {
  const record = event.Records[0];
  const message: GuessMessage = JSON.parse(record.body);
  const { userId, guessId, instrument, direction, startPrice, startTime, retryCount = 0 } = message;

  // Add contextual logging and tracing
  logger.appendKeys({ userId, guessId, instrument });
  tracer.putAnnotation('userId', userId);
  tracer.putAnnotation('guessId', guessId);
  tracer.putAnnotation('instrument', instrument);
  tracer.putAnnotation('retryCount', retryCount);

  logger.info('Resolving guess', {
    userId,
    guessId,
    instrument,
    direction,
    startPrice,
    retryCount,
    maxRetries: MAX_RETRIES
  });

  try {
    // First, check for historical prices from cache (at least 60s after guess started)
    const minTimestamp = startTime + MIN_TIME_ELAPSED;
    logger.info('Checking for historical price', {
      minTimestamp,
      minTime: new Date(minTimestamp).toISOString()
    });

    let endPrice = await findDifferentPriceAfter(minTimestamp, startPrice, instrument);

    if (endPrice) {
      logger.info('Found different historical price', { endPrice, startPrice });
      tracer.putAnnotation('priceSource', 'historical');
    } else {
      // No different historical price found, fetch current price (which will cache it for others)
      logger.info('No different historical price found, fetching current price');
      const currentPrice = await getCurrentInstrumentPrice(instrument);
      logger.info('Current price fetched from API', { currentPrice });

      if (currentPrice === startPrice && retryCount < MAX_RETRIES) {
        // Price still unchanged, requeue for retry
        logger.info('Price unchanged, requeuing message', {
          currentPrice,
          retryCount: retryCount + 1,
          maxRetries: MAX_RETRIES,
          retryDelaySeconds: RETRY_DELAY
        });

        tracer.putAnnotation('priceChanged', false);
        tracer.putAnnotation('requeued', true);

        const retryMessage: GuessMessage = {
          userId,
          guessId,
          instrument,
          direction,
          startPrice,
          startTime,
          retryCount: retryCount + 1
        };

        await sqsClient.send(new SendMessageCommand({
          QueueUrl: QUEUE_URL,
          MessageBody: JSON.stringify(retryMessage),
          DelaySeconds: RETRY_DELAY
        }));

        logger.info('Message requeued successfully', { nextRetryCount: retryCount + 1 });
        return; // Exit successfully - message requeued
      }

      endPrice = currentPrice;
      tracer.putAnnotation('priceSource', 'current');
    }

    logger.info('Final end price determined', { endPrice, startPrice });
    tracer.putMetadata('priceResolution', { startPrice, endPrice, priceChanged: endPrice !== startPrice });

    // Calculate result
    let correct = false;
    if (endPrice > startPrice) {
      correct = direction === 'up';
    } else if (endPrice < startPrice) {
      correct = direction === 'down';
    } else {
      // Price exactly the same after all retries - mark as incorrect
      logger.warn('Price unchanged after all retries - marking as incorrect', {
        startPrice,
        endPrice,
        retriesAttempted: retryCount
      });
      correct = false;
    }

    const scoreChange = correct ? 1 : -1;

    logger.info('Guess result calculated', {
      correct,
      direction,
      priceMovement: endPrice > startPrice ? 'up' : endPrice < startPrice ? 'down' : 'unchanged',
      scoreChange
    });

    tracer.putAnnotation('guessCorrect', correct);
    tracer.putAnnotation('scoreChange', scoreChange);

    // Update user score and resolve guess
    await updateUserScore(userId, scoreChange);
    await resolveGuess(userId, startTime, endPrice, correct, scoreChange);

    logger.info('Guess resolved successfully', {
      guessId,
      correct,
      scoreChange,
      endPrice
    });
  } catch (error) {
    logger.error('Error resolving guess', { error, userId, guessId, retryCount });
    // Let the message go to DLQ for manual inspection
    throw error;
  }
};

export const handler = wrapHandler(lambdaHandler);
