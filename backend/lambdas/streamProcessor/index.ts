import { DynamoDBStreamEvent } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { logger, tracer, wrapHandler } from '../shared/powertools';

const APPSYNC_ENDPOINT = process.env.APPSYNC_ENDPOINT!;
const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY!;

const UPDATE_GUESS_STATUS_MUTATION = `
  mutation UpdateGuessStatus($userId: ID!, $guess: GuessInput!) {
    updateGuessStatus(userId: $userId, guess: $guess) {
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
`;

const UPDATE_PRICE_MUTATION = `
  mutation UpdatePrice($instrument: String!, $price: Float!, $timestamp: AWSTimestamp!) {
    updatePrice(instrument: $instrument, price: $price, timestamp: $timestamp) {
      instrument
      price
      timestamp
    }
  }
`;

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

const lambdaHandler = async (event: DynamoDBStreamEvent): Promise<void> => {
  logger.info('Processing DynamoDB stream', { recordCount: event.Records.length });

  for (const record of event.Records) {
    try {
      const newImage = record.dynamodb?.NewImage;
      if (!newImage) {
        logger.debug('No NewImage in record, skipping');
        continue;
      }

      const item = unmarshall(newImage as Record<string, AttributeValue>);

      // Handle resolved guess updates (SK starts with GUESS# and is resolved)
      if (item.SK?.startsWith('GUESS#') && item.resolved && record.eventName === 'MODIFY') {
        await handleGuessResolution(item);
      }

      // Handle price updates
      if (item.entityType === 'PRICE' && record.eventName === 'INSERT') {
        await handlePriceUpdate(item);
      }
    } catch (error) {
      logger.error('Error processing stream record', {
        error,
        eventName: record.eventName,
        eventID: record.eventID
      });
      // Don't throw - continue processing other records
    }
  }
};

async function handleGuessResolution(item: any): Promise<void> {
  // Extract userId from PK (format: USER#<userId>)
  const userId = item.PK.replace('USER#', '');
  const guessId = item.guessId;

  logger.appendKeys({ userId, guessId });
  tracer.putAnnotation('userId', userId);
  tracer.putAnnotation('guessId', guessId);
  tracer.putAnnotation('streamEventType', 'guess_resolution');

  // Default to BTCUSD if instrument field is missing (for backwards compatibility with old records)
  const instrument = item.instrument || 'BTCUSD';

  if (!item.instrument) {
    logger.warn('Guess missing instrument field, defaulting to BTCUSD', { guessId });
  }

  const guess: Guess = {
    guessId: item.guessId,
    userId: item.userId || userId,
    instrument: instrument,
    direction: item.direction,
    startPrice: item.startPrice,
    startTime: item.startTime,
    resolved: item.resolved,
    endPrice: item.endPrice,
    correct: item.correct,
    scoreChange: item.scoreChange,
    resolvedAt: item.resolvedAt
  };

  logger.info('Publishing guess resolution', {
    userId,
    guessId,
    instrument,
    correct: guess.correct,
    scoreChange: guess.scoreChange
  });

  tracer.putMetadata('guessResolution', {
    instrument,
    direction: guess.direction,
    correct: guess.correct,
    scoreChange: guess.scoreChange,
    startPrice: guess.startPrice,
    endPrice: guess.endPrice
  });

  const variables = {
    userId,
    guess: {
      guessId: guess.guessId,
      userId: userId,
      instrument: instrument, // Use the validated instrument value
      direction: guess.direction,
      startPrice: guess.startPrice,
      startTime: guess.startTime,
      resolved: guess.resolved,
      endPrice: guess.endPrice,
      correct: guess.correct,
      scoreChange: guess.scoreChange,
      resolvedAt: guess.resolvedAt
    }
  };

  const result = await callAppSync(UPDATE_GUESS_STATUS_MUTATION, variables);
  logger.info('Successfully published guess resolution to AppSync', { guessId });
  logger.debug('AppSync mutation result', { result });
}

async function handlePriceUpdate(item: any): Promise<void> {
  // Extract instrument from PK (format: INSTRUMENT#<symbol>)
  const instrument = item.PK.replace('INSTRUMENT#', '');
  const price = item.price;
  const timestamp = item.timestamp;

  logger.appendKeys({ instrument });
  tracer.putAnnotation('instrument', instrument);
  tracer.putAnnotation('streamEventType', 'price_update');

  logger.info('Publishing price update', { instrument, price, timestamp });

  tracer.putMetadata('priceUpdate', {
    instrument,
    price,
    timestamp
  });

  const variables = {
    instrument,
    price,
    timestamp
  };

  await callAppSync(UPDATE_PRICE_MUTATION, variables);
  logger.info('Successfully published price update to AppSync', { instrument, price });
}

async function callAppSync(query: string, variables: any): Promise<any> {
  const body = JSON.stringify({ query, variables });

  logger.debug('Calling AppSync', { endpoint: APPSYNC_ENDPOINT });

  const response = await fetch(APPSYNC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': APPSYNC_API_KEY
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`AppSync error: ${response.status} ${response.statusText} - ${errorText}`);
    logger.error('AppSync request failed', { error, status: response.status, statusText: response.statusText });
    throw error;
  }

  const result: any = await response.json();

  if (result.errors) {
    const error = new Error(`AppSync GraphQL errors: ${JSON.stringify(result.errors)}`);
    logger.error('AppSync GraphQL errors', { error, errors: result.errors });
    throw error;
  }

  logger.debug('AppSync response received', { hasData: !!result.data });
  return result;
}

export const handler = wrapHandler(lambdaHandler);
