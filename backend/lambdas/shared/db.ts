import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

export interface User {
  userId: string;
  email: string;
  score: number;
  createdAt: number;
  updatedAt: number;
}

export interface Guess {
  guessId: string;
  userId: string;
  direction: 'up' | 'down';
  startPrice: number;
  startTime: number;
  resolved: boolean;
  endPrice?: number;
  correct?: boolean;
  scoreChange?: number;
  resolvedAt?: number;
}

export async function getUser(userId: string): Promise<User | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
  }));

  if (!result.Item) return null;

  return {
    userId,
    email: result.Item.email,
    score: result.Item.score || 0,
    createdAt: result.Item.createdAt,
    updatedAt: result.Item.updatedAt
  };
}

export async function createUser(userId: string, email: string): Promise<User> {
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  const user: User = { userId, email, score: 0, createdAt: now, updatedAt: now };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
      entityType: 'USER_PROFILE',
      ...user
    }
  }));

  return user;
}

export async function getActiveGuess(userId: string): Promise<Guess | null> {
  // Query for the most recent unresolved guess
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    FilterExpression: 'resolved = :false',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'GUESS#',
      ':false': false
    },
    ScanIndexForward: false, // Most recent first
    Limit: 1
  }));

  if (!result.Items || result.Items.length === 0) return null;
  return result.Items[0] as Guess;
}

export async function createGuess(userId: string, guess: Guess): Promise<void> {
  // Use startTime as part of the SK for natural ordering
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `USER#${userId}`,
      SK: `GUESS#${guess.startTime}`,
      entityType: 'GUESS',
      ...guess
    }
  }));
}

export async function updateUserScore(userId: string, scoreChange: number): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    UpdateExpression: 'SET score = score + :change, updatedAt = :now',
    ExpressionAttributeValues: {
      ':change': scoreChange,
      ':now': Math.floor(Date.now() / 1000) // Unix timestamp in seconds
    }
  }));
}

export async function resolveGuess(
  userId: string,
  guessStartTime: number,
  endPrice: number,
  correct: boolean,
  scoreChange: number
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `USER#${userId}`, SK: `GUESS#${guessStartTime}` },
    UpdateExpression: 'SET resolved = :true, endPrice = :endPrice, correct = :correct, scoreChange = :scoreChange, resolvedAt = :now',
    ExpressionAttributeValues: {
      ':true': true,
      ':endPrice': endPrice,
      ':correct': correct,
      ':scoreChange': scoreChange,
      ':now': now
    }
  }));
}

export async function getGuessHistory(userId: string, limit: number = 10): Promise<Guess[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    FilterExpression: 'resolved = :true',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'GUESS#',
      ':true': true
    },
    ScanIndexForward: false, // Most recent first
    Limit: limit
  }));

  return (result.Items || []).map(item => item as Guess);
}
