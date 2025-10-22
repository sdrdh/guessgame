import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;
const CACHE_TTL = 5000; // 5 seconds

export async function getCurrentInstrumentPrice(instrument: string = 'BTCUSD'): Promise<number> {
  // Check cache
  const cachedPrice = await getCachedPrice(instrument);
  if (cachedPrice) {
    console.log(`Cache hit for ${instrument}: $${cachedPrice.price} (age: ${Date.now() - cachedPrice.timestamp}ms)`);
    return cachedPrice.price;
  }

  // Fetch from CoinGecko
  console.log(`Cache miss - fetching ${instrument} from CoinGecko...`);
  const [coinId, currency] = instrument === 'BTCUSD' ? ['bitcoin', 'usd'] : ['bitcoin', 'usd'];
  const price = await fetchFromCoinGecko(coinId, currency);

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
    console.error('Cache read error:', error);
    return null;
  }
}

async function fetchFromCoinGecko(coinId: string, currency: string): Promise<number> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${currency}&precision=2`
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.statusText}`);
  }

  const data: any = await response.json();
  return data[coinId][currency];
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
        source: 'coingecko',
        ttl: Math.floor(timestamp / 1000) + (7 * 24 * 60 * 60) // 7 days
      }
    }));
  } catch (error) {
    console.error('Cache write error:', error);
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
    console.error('Error getting price after timestamp:', error);
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
    console.error('Error finding different price after timestamp:', error);
    return null;
  }
}
