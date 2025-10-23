import { DynamoDBStreamEvent } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';

const APPSYNC_ENDPOINT = process.env.APPSYNC_ENDPOINT!;
const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY!;

const UPDATE_GUESS_STATUS_MUTATION = `
  mutation UpdateGuessStatus($userId: ID!, $guess: GuessInput!) {
    updateGuessStatus(userId: $userId, guess: $guess) {
      guessId
      userId
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

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  console.log('streamProcessor event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const newImage = record.dynamodb?.NewImage;
      if (!newImage) {
        console.log('No NewImage in record');
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
      console.error('Error processing stream record:', error);
      // Don't throw - continue processing other records
    }
  }
};

async function handleGuessResolution(item: any): Promise<void> {
  // Extract userId from PK (format: USER#<userId>)
  const userId = item.PK.replace('USER#', '');

  const guess: Guess = {
    guessId: item.guessId,
    userId: item.userId || userId,
    instrument: item.instrument,
    direction: item.direction,
    startPrice: item.startPrice,
    startTime: item.startTime,
    resolved: item.resolved,
    endPrice: item.endPrice,
    correct: item.correct,
    scoreChange: item.scoreChange,
    resolvedAt: item.resolvedAt
  };

  console.log(`Publishing guess resolution for user ${userId}:`, guess);

  const variables = {
    userId,
    guess: {
      guessId: guess.guessId,
      userId: userId,
      instrument: guess.instrument,
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
  console.log('Successfully published guess resolution to AppSync');
  console.log('AppSync mutation result:', JSON.stringify(result, null, 2));
}

async function handlePriceUpdate(item: any): Promise<void> {
  // Extract instrument from PK (format: INSTRUMENT#<symbol>)
  const instrument = item.PK.replace('INSTRUMENT#', '');
  const price = item.price;
  const timestamp = item.timestamp;

  console.log(`Publishing price update: ${instrument} = $${price} at ${timestamp}`);

  const variables = {
    instrument,
    price,
    timestamp
  };

  await callAppSync(UPDATE_PRICE_MUTATION, variables);
  console.log('Successfully published price update to AppSync');
}

async function callAppSync(query: string, variables: any): Promise<any> {
  const body = JSON.stringify({ query, variables });

  console.log('Calling AppSync with:', body);

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
    throw new Error(`AppSync error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result: any = await response.json();

  if (result.errors) {
    throw new Error(`AppSync GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  console.log('AppSync response:', JSON.stringify(result));
  return result;
}
