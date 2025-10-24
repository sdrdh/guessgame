import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { logger, tracer } from './powertools';

const client = tracer.captureAWSv3Client(new DynamoDBClient({}));
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;
const CACHE_TTL = 5000; // 5 seconds

export async function getCurrentInstrumentPrice(instrument: string = 'BTCUSD'): Promise<number> {
  // Check cache
  const cachedPrice = await getCachedPrice(instrument);
  if (cachedPrice) {
    const age = Date.now() - cachedPrice.timestamp;
    logger.info('Cache hit for instrument price', { instrument, price: cachedPrice.price, cacheAgeMs: age });
    tracer.putAnnotation('priceCacheHit', true);
    return cachedPrice.price;
  }

  // Fetch from Coinbase
  logger.info('Cache miss - fetching from Coinbase', { instrument });
  tracer.putAnnotation('priceCacheHit', false);
  const price = await fetchFromCoinbase(instrument);

  // Store in cache
  await storePrice(instrument, price);

  return price;
}

async function getCachedPrice(instrument: string): Promise<{ price: number; timestamp: number } | null> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `INSTRUMENT#${instrument}` },
      ScanIndexForward: false,
      Limit: 1
    }));

    if (!result.Items || result.Items.length === 0) return null;

    const item = result.Items[0];
    const age = Date.now() - item.timestamp;

    if (age < CACHE_TTL) {
      return { price: item.price, timestamp: item.timestamp };
    }

    return null;
  } catch (error) {
    logger.error('Cache read error', error as Error);
    return null;
  }
}

async function fetchFromCoinbase(instrument: string): Promise<number> {
  // Map instrument to Coinbase pair format (e.g., BTCUSD -> BTC-USD)
  const pair = instrument === 'BTCUSD' ? 'BTC-USD' : 'BTC-USD';

  const response = await fetch(
    `https://api.coinbase.com/v2/prices/${pair}/spot`
  );

  if (!response.ok) {
    throw new Error(`Coinbase API error: ${response.statusText}`);
  }

  const data: any = await response.json();
  return parseFloat(data.data.amount);
}

async function storePrice(instrument: string, price: number): Promise<void> {
  const timestamp = Date.now();

  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `INSTRUMENT#${instrument}`,
        SK: `TIMESTAMP#${timestamp}`,
        entityType: 'PRICE',
        price,
        timestamp,
        source: 'coinbase',
        ttl: Math.floor(timestamp / 1000) + (7 * 24 * 60 * 60) // 7 days
      }
    }));
    logger.info('Price stored in cache', { instrument, price, timestamp });
  } catch (error) {
    logger.error('Cache write error', error as Error);
  }
}

export async function getPriceAfter(startTime: number, instrument: string = 'BTCUSD'): Promise<number | null> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK > :sk',
      ExpressionAttributeValues: {
        ':pk': `INSTRUMENT#${instrument}`,
        ':sk': `TIMESTAMP#${startTime}`
      },
      ScanIndexForward: true,
      Limit: 1
    }));

    if (!result.Items || result.Items.length === 0) return null;
    return result.Items[0].price;
  } catch (error) {
    logger.error('Error getting price after timestamp', error as Error);
    return null;
  }
}

export async function findDifferentPriceAfter(
  startTime: number,
  referencePrice: number,
  instrument: string = 'BTCUSD'
): Promise<number | null> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK > :sk',
      FilterExpression: 'price <> :refPrice',
      ExpressionAttributeValues: {
        ':pk': `INSTRUMENT#${instrument}`,
        ':sk': `TIMESTAMP#${startTime}`,
        ':refPrice': referencePrice
      },
      ScanIndexForward: true,
      Limit: 1
    }));

    if (!result.Items || result.Items.length === 0) return null;
    return result.Items[0].price;
  } catch (error) {
    logger.error('Error finding different price after timestamp', error as Error);
    return null;
  }
}
