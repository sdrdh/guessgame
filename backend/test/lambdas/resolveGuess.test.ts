import { handler } from '../../lambdas/resolveGuess/index';
import { SQSEvent } from 'aws-lambda';
import * as db from '../../lambdas/shared/db';
import * as instrumentPrice from '../../lambdas/shared/instrumentPrice';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

// Mock dependencies
jest.mock('../../lambdas/shared/db');
jest.mock('../../lambdas/shared/instrumentPrice');
jest.mock('@aws-sdk/client-sqs');

process.env.TABLE_NAME = 'test-table';
process.env.QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/test-queue';

describe('resolveGuess Lambda', () => {
  const mockFindDifferentPriceAfter = instrumentPrice.findDifferentPriceAfter as jest.MockedFunction<typeof instrumentPrice.findDifferentPriceAfter>;
  const mockGetCurrentInstrumentPrice = instrumentPrice.getCurrentInstrumentPrice as jest.MockedFunction<typeof instrumentPrice.getCurrentInstrumentPrice>;
  const mockUpdateUserScore = db.updateUserScore as jest.MockedFunction<typeof db.updateUserScore>;
  const mockResolveGuess = db.resolveGuess as jest.MockedFunction<typeof db.resolveGuess>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createSQSEvent = (messageBody: any): SQSEvent => ({
    Records: [
      {
        messageId: 'msg-123',
        receiptHandle: 'receipt-123',
        body: JSON.stringify(messageBody),
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: '1',
          SenderId: 'sender-123',
          ApproximateFirstReceiveTimestamp: '1'
        },
        messageAttributes: {},
        md5OfBody: 'md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:123:queue',
        awsRegion: 'us-east-1'
      }
    ]
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should be a function', () => {
    expect(typeof handler).toBe('function');
  });

  describe('Successful Resolution with Historical Price', () => {
    it('should resolve correctly with UP guess and price increase', async () => {
      const mockGuessMessage = {
        userId: 'user-123',
        guessId: 'guess-456',
        direction: 'up',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 0
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(46000);
      mockUpdateUserScore.mockResolvedValue(undefined);
      mockResolveGuess.mockResolvedValue(undefined);

      await handler(event);

      expect(mockFindDifferentPriceAfter).toHaveBeenCalled();
      expect(mockUpdateUserScore).toHaveBeenCalledWith('user-123', 1);
      expect(mockResolveGuess).toHaveBeenCalledWith('user-123', expect.any(Number), 46000, true, 1);
    });

    it('should resolve correctly with UP guess and price decrease', async () => {
      const mockGuessMessage = {
        userId: 'user-456',
        guessId: 'guess-789',
        direction: 'up',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 0
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(44000);
      mockUpdateUserScore.mockResolvedValue(undefined);
      mockResolveGuess.mockResolvedValue(undefined);

      await handler(event);

      expect(mockUpdateUserScore).toHaveBeenCalledWith('user-456', -1);
      expect(mockResolveGuess).toHaveBeenCalledWith('user-456', expect.any(Number), 44000, false, -1);
    });

    it('should resolve correctly with DOWN guess and price decrease', async () => {
      const mockGuessMessage = {
        userId: 'user-789',
        guessId: 'guess-101',
        direction: 'down',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 0
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(44000);
      mockUpdateUserScore.mockResolvedValue(undefined);
      mockResolveGuess.mockResolvedValue(undefined);

      await handler(event);

      expect(mockUpdateUserScore).toHaveBeenCalledWith('user-789', 1);
      expect(mockResolveGuess).toHaveBeenCalledWith('user-789', expect.any(Number), 44000, true, 1);
    });

    it('should resolve correctly with DOWN guess and price increase', async () => {
      const mockGuessMessage = {
        userId: 'user-321',
        guessId: 'guess-202',
        direction: 'down',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 0
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(46000);
      mockUpdateUserScore.mockResolvedValue(undefined);
      mockResolveGuess.mockResolvedValue(undefined);

      await handler(event);

      expect(mockUpdateUserScore).toHaveBeenCalledWith('user-321', -1);
      expect(mockResolveGuess).toHaveBeenCalledWith('user-321', expect.any(Number), 46000, false, -1);
    });
  });

  describe('Price Unchanged - Retry Logic', () => {
    it('should requeue message if no historical price found and current price unchanged (first retry)', async () => {
      const mockGuessMessage = {
        userId: 'user-123',
        guessId: 'guess-456',
        direction: 'up',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 0
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(null);
      mockGetCurrentInstrumentPrice.mockResolvedValue(45000); // Same price

      const mockSend = jest.fn().mockResolvedValue({});
      (SQSClient.prototype.send as jest.Mock) = mockSend;

      await handler(event);

      expect(mockSend).toHaveBeenCalledWith(expect.any(SendMessageCommand));
      const sendCall = mockSend.mock.calls[0][0];
      const messageBody = JSON.parse(sendCall.input.MessageBody);

      expect(messageBody.retryCount).toBe(1);
      expect(sendCall.input.DelaySeconds).toBe(10);
      expect(mockUpdateUserScore).not.toHaveBeenCalled();
      expect(mockResolveGuess).not.toHaveBeenCalled();
    });

    it('should continue retrying up to max retries', async () => {
      const mockGuessMessage = {
        userId: 'user-123',
        guessId: 'guess-456',
        direction: 'up',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 3
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(null);
      mockGetCurrentInstrumentPrice.mockResolvedValue(45000);

      const mockSend = jest.fn().mockResolvedValue({});
      (SQSClient.prototype.send as jest.Mock) = mockSend;

      await handler(event);

      const sendCall = mockSend.mock.calls[0][0];
      const messageBody = JSON.parse(sendCall.input.MessageBody);

      expect(messageBody.retryCount).toBe(4);
    });

    it('should mark as incorrect after max retries with unchanged price', async () => {
      const mockGuessMessage = {
        userId: 'user-123',
        guessId: 'guess-456',
        direction: 'up',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 6 // Max retries reached
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(null);
      mockGetCurrentInstrumentPrice.mockResolvedValue(45000);
      mockUpdateUserScore.mockResolvedValue(undefined);
      mockResolveGuess.mockResolvedValue(undefined);

      await handler(event);

      expect(mockUpdateUserScore).toHaveBeenCalledWith('user-123', -1);
      expect(mockResolveGuess).toHaveBeenCalledWith('user-123', expect.any(Number), 45000, false, -1);
    });
  });

  describe('Current Price Resolution (No Historical Price)', () => {
    it('should use current price if different and no historical price available', async () => {
      const mockGuessMessage = {
        userId: 'user-999',
        guessId: 'guess-999',
        direction: 'up',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 0
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(null);
      mockGetCurrentInstrumentPrice.mockResolvedValue(46500);
      mockUpdateUserScore.mockResolvedValue(undefined);
      mockResolveGuess.mockResolvedValue(undefined);

      await handler(event);

      expect(mockGetCurrentInstrumentPrice).toHaveBeenCalledWith('BTCUSD');
      expect(mockUpdateUserScore).toHaveBeenCalledWith('user-999', 1);
      expect(mockResolveGuess).toHaveBeenCalledWith('user-999', expect.any(Number), 46500, true, 1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small price changes', async () => {
      const mockGuessMessage = {
        userId: 'user-111',
        guessId: 'guess-111',
        direction: 'up',
        startPrice: 45000.00,
        startTime: Date.now() - 65000,
        retryCount: 0
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(45000.01);
      mockUpdateUserScore.mockResolvedValue(undefined);
      mockResolveGuess.mockResolvedValue(undefined);

      await handler(event);

      expect(mockUpdateUserScore).toHaveBeenCalledWith('user-111', 1);
      expect(mockResolveGuess).toHaveBeenCalledWith('user-111', expect.any(Number), 45000.01, true, 1);
    });

    it('should handle large price changes', async () => {
      const mockGuessMessage = {
        userId: 'user-222',
        guessId: 'guess-222',
        direction: 'down',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 0
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(35000); // 22% drop
      mockUpdateUserScore.mockResolvedValue(undefined);
      mockResolveGuess.mockResolvedValue(undefined);

      await handler(event);

      expect(mockUpdateUserScore).toHaveBeenCalledWith('user-222', 1);
      expect(mockResolveGuess).toHaveBeenCalledWith('user-222', expect.any(Number), 35000, true, 1);
    });

    it('should handle retry count starting from non-zero', async () => {
      const mockGuessMessage = {
        userId: 'user-333',
        guessId: 'guess-333',
        direction: 'up',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 2
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(null);
      mockGetCurrentInstrumentPrice.mockResolvedValue(45000);

      const mockSend = jest.fn().mockResolvedValue({});
      (SQSClient.prototype.send as jest.Mock) = mockSend;

      await handler(event);

      const sendCall = mockSend.mock.calls[0][0];
      const messageBody = JSON.parse(sendCall.input.MessageBody);

      expect(messageBody.retryCount).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should propagate DynamoDB errors', async () => {
      const mockGuessMessage = {
        userId: 'user-123',
        guessId: 'guess-456',
        direction: 'up',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 0
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(46000);
      mockUpdateUserScore.mockRejectedValue(new Error('DynamoDB update failed'));

      await expect(handler(event)).rejects.toThrow('DynamoDB update failed');
    });

    it('should propagate price fetch errors', async () => {
      const mockGuessMessage = {
        userId: 'user-123',
        guessId: 'guess-456',
        direction: 'up',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 0
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockRejectedValue(new Error('Price query failed'));

      await expect(handler(event)).rejects.toThrow('Price query failed');
    });

    it('should propagate SQS requeue errors', async () => {
      const mockGuessMessage = {
        userId: 'user-123',
        guessId: 'guess-456',
        direction: 'up',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 0
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(null);
      mockGetCurrentInstrumentPrice.mockResolvedValue(45000);
      (SQSClient.prototype.send as jest.Mock).mockRejectedValue(new Error('SQS send failed'));

      await expect(handler(event)).rejects.toThrow('SQS send failed');
    });
  });

  describe('Score Calculation', () => {
    it('should add 1 point for correct guess', async () => {
      const mockGuessMessage = {
        userId: 'user-correct',
        guessId: 'guess-correct',
        direction: 'up',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 0
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(46000);
      mockUpdateUserScore.mockResolvedValue(undefined);
      mockResolveGuess.mockResolvedValue(undefined);

      await handler(event);

      expect(mockUpdateUserScore).toHaveBeenCalledWith('user-correct', 1);
    });

    it('should subtract 1 point for incorrect guess', async () => {
      const mockGuessMessage = {
        userId: 'user-wrong',
        guessId: 'guess-wrong',
        direction: 'up',
        startPrice: 45000,
        startTime: Date.now() - 65000,
        retryCount: 0
      };

      const event = createSQSEvent(mockGuessMessage);

      mockFindDifferentPriceAfter.mockResolvedValue(44000);
      mockUpdateUserScore.mockResolvedValue(undefined);
      mockResolveGuess.mockResolvedValue(undefined);

      await handler(event);

      expect(mockUpdateUserScore).toHaveBeenCalledWith('user-wrong', -1);
    });
  });
});
