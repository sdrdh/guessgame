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
  createdAt: string;
  updatedAt: string;
}

export interface Guess {
  guessId: string;
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
  const now = new Date().toISOString();
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
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: `USER#${userId}`, SK: 'GUESS#ACTIVE' }
  }));

  if (!result.Item || result.Item.resolved) return null;
  return result.Item as Guess;
}

export async function createGuess(userId: string, guess: Guess): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `USER#${userId}`,
      SK: 'GUESS#ACTIVE',
      entityType: 'GUESS',
      status: 'ACTIVE',
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
      ':now': new Date().toISOString()
    }
  }));
}

export async function resolveGuess(
  userId: string,
  endPrice: number,
  correct: boolean,
  scoreChange: number
): Promise<void> {
  const now = Date.now();

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `USER#${userId}`, SK: 'GUESS#ACTIVE' },
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
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'GUESS#'
    },
    ScanIndexForward: false,
    Limit: limit + 1
  }));

  return (result.Items || [])
    .filter(item => item.SK !== 'GUESS#ACTIVE' && item.resolved)
    .map(item => item as Guess);
}
