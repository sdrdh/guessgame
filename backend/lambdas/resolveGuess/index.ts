import { SQSEvent } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { updateUserScore, resolveGuess } from '../shared/db';
import { getCurrentInstrumentPrice, findDifferentPriceAfter } from '../shared/instrumentPrice';

const sqsClient = new SQSClient({});
const QUEUE_URL = process.env.QUEUE_URL!;
const MAX_RETRIES = 6; // Max retries if price unchanged
const RETRY_DELAY = 10; // seconds
const MIN_TIME_ELAPSED = 60000; // 60 seconds in milliseconds

interface GuessMessage {
  userId: string;
  guessId: string;
  direction: 'up' | 'down';
  startPrice: number;
  startTime: number;
  retryCount?: number;
}

export const handler = async (event: SQSEvent): Promise<void> => {
  const record = event.Records[0];
  const message: GuessMessage = JSON.parse(record.body);
  const { userId, guessId, direction, startPrice, startTime, retryCount = 0 } = message;

  console.log(`Resolving guess ${guessId} for user ${userId} (retry ${retryCount}/${MAX_RETRIES})`);
  console.log(`Start price: $${startPrice}, Direction: ${direction}`);

  try {
    // First, check for historical prices from cache (at least 60s after guess started)
    const minTimestamp = startTime + MIN_TIME_ELAPSED;
    console.log(`Checking for historical price after ${new Date(minTimestamp).toISOString()}...`);

    let endPrice = await findDifferentPriceAfter(minTimestamp, startPrice, 'BTCUSD');

    if (endPrice) {
      console.log(`Found different historical price: $${endPrice}`);
    } else {
      // No different historical price found, fetch current price (which will cache it for others)
      console.log('No different historical price found, fetching current price...');
      const currentPrice = await getCurrentInstrumentPrice('BTCUSD');
      console.log(`Current price from API: $${currentPrice}`);

      if (currentPrice === startPrice && retryCount < MAX_RETRIES) {
        // Price still unchanged, requeue for retry
        console.log(`Price unchanged ($${currentPrice}), requeuing with ${RETRY_DELAY}s delay (retry ${retryCount + 1}/${MAX_RETRIES})`);

        const retryMessage: GuessMessage = {
          userId,
          guessId,
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

        console.log('Message requeued successfully');
        return; // Exit successfully - message requeued
      }

      endPrice = currentPrice;
    }

    console.log(`Final end price: $${endPrice}`);

    // Calculate result
    let correct = false;
    if (endPrice > startPrice) {
      correct = direction === 'up';
    } else if (endPrice < startPrice) {
      correct = direction === 'down';
    } else {
      // Price exactly the same after all retries - mark as incorrect
      console.log('Price unchanged after all retries - marking as incorrect');
      correct = false;
    }

    const scoreChange = correct ? 1 : -1;

    console.log(`Guess ${correct ? 'correct' : 'incorrect'}: ${direction.toUpperCase()} prediction, price went from $${startPrice} to $${endPrice}`);
    console.log(`Score change: ${scoreChange > 0 ? '+' : ''}${scoreChange}`);

    // Update user score and resolve guess
    await updateUserScore(userId, scoreChange);
    await resolveGuess(userId, endPrice, correct, scoreChange);

    console.log(`Guess ${guessId} resolved successfully`);
  } catch (error) {
    console.error('Error resolving guess:', error);
    // Let the message go to DLQ for manual inspection
    throw error;
  }
};
