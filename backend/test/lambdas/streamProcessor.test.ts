// Set environment variables before importing the module
process.env.TABLE_NAME = 'test-table';
process.env.APPSYNC_ENDPOINT = 'https://test.appsync-api.us-east-1.amazonaws.com/graphql';
process.env.APPSYNC_API_KEY = 'test-api-key';

import { handler } from '../../lambdas/streamProcessor/index';
import { DynamoDBStreamEvent } from 'aws-lambda';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('streamProcessor Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should be a function', () => {
    expect(typeof handler).toBe('function');
  });

  it('should process resolved guess from DynamoDB stream', async () => {
    const mockGuess: any = {
      PK: { S: 'USER#user-123' },
      SK: { S: 'GUESS#ACTIVE' },
      guessId: { S: 'guess-456' },
      direction: { S: 'up' },
      startPrice: { N: '45000' },
      startTime: { N: String(Date.now()) },
      resolved: { BOOL: true },
      endPrice: { N: '46000' },
      correct: { BOOL: true },
      scoreChange: { N: '1' },
      resolvedAt: { N: String(Date.now()) }
    };

    const event: DynamoDBStreamEvent = {
      Records: [
        {
          eventID: 'event-123',
          eventName: 'MODIFY',
          eventVersion: '1.1',
          eventSource: 'aws:dynamodb',
          awsRegion: 'us-east-1',
          dynamodb: {
            Keys: {
              PK: { S: 'USER#user-123' },
              SK: { S: 'GUESS#ACTIVE' }
            },
            NewImage: mockGuess,
            StreamViewType: 'NEW_AND_OLD_IMAGES',
            SequenceNumber: '123',
            SizeBytes: 100
          },
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123:table/test/stream/123'
        }
      ]
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { updateGuessStatus: {} } })
    });

    await handler(event);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toBe(process.env.APPSYNC_ENDPOINT);
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].headers['x-api-key']).toBe(process.env.APPSYNC_API_KEY);
  });

  it('should skip non-MODIFY events', async () => {
    const event: DynamoDBStreamEvent = {
      Records: [
        {
          eventID: 'event-123',
          eventName: 'INSERT',
          eventVersion: '1.1',
          eventSource: 'aws:dynamodb',
          awsRegion: 'us-east-1',
          dynamodb: {
            Keys: {
              PK: { S: 'USER#user-123' },
              SK: { S: 'GUESS#ACTIVE' }
            },
            StreamViewType: 'NEW_AND_OLD_IMAGES',
            SequenceNumber: '123',
            SizeBytes: 100
          },
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123:table/test/stream/123'
        }
      ]
    };

    await handler(event);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
