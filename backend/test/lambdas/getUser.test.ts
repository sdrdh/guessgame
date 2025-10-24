import { handler } from '../../lambdas/getUser/index';
import { AppSyncResolverEvent } from 'aws-lambda';
import { createMockContext } from '../helpers';
import * as db from '../../lambdas/shared/db';

// Mock dependencies
jest.mock('../../lambdas/shared/db');

process.env.TABLE_NAME = 'test-table';

describe('getUser Lambda', () => {
  const mockGetUser = db.getUser as jest.MockedFunction<typeof db.getUser>;
  const mockGetActiveGuess = db.getActiveGuess as jest.MockedFunction<typeof db.getActiveGuess>;
  const context = createMockContext();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should throw error if no user ID in token', async () => {
    const event = {
      arguments: {},
      identity: null,
      info: { fieldName: 'getUser' }
    } as unknown as AppSyncResolverEvent<{}>;

    await expect(handler(event, context)).rejects.toThrow('Unauthorized');
  });

  it('should return null if user not found', async () => {
    mockGetUser.mockResolvedValue(null);

    const event = {
      arguments: {},
      identity: { claims: { sub: 'user-123' } },
      info: { fieldName: 'getUser' }
    } as any;

    const result = await handler(event, context);
    expect(result).toBeNull();
    expect(mockGetUser).toHaveBeenCalledWith('user-123');
  });

  it('should return user with active guess', async () => {
    const mockUser = {
      userId: 'user-123',
      email: 'test@example.com',
      score: 10,
      createdAt: 1704067200,
      updatedAt: 1704067200
    };

    const mockGuess = {
      guessId: 'guess-123',
      userId: 'user-123',
      instrument: 'BTCUSD',
      direction: 'up' as const,
      startPrice: 45000,
      startTime: Date.now(),
      resolved: false
    };

    mockGetUser.mockResolvedValue(mockUser);
    mockGetActiveGuess.mockResolvedValue(mockGuess);

    const event = {
      arguments: {},
      identity: { claims: { sub: 'user-123' } },
      info: { fieldName: 'getUser' }
    } as any;

    const result = await handler(event, context);

    expect(result).toEqual({
      ...mockUser,
      activeGuess: mockGuess
    });
    expect(mockGetUser).toHaveBeenCalledWith('user-123');
    expect(mockGetActiveGuess).toHaveBeenCalledWith('user-123');
  });

  it('should return user without active guess', async () => {
    const mockUser = {
      userId: 'user-123',
      email: 'test@example.com',
      score: 10,
      createdAt: 1704067200,
      updatedAt: 1704067200
    };

    mockGetUser.mockResolvedValue(mockUser);
    mockGetActiveGuess.mockResolvedValue(null);

    const event = {
      arguments: {},
      identity: { claims: { sub: 'user-123' } },
      info: { fieldName: 'getUser' }
    } as any;

    const result = await handler(event, context);

    expect(result).toEqual({
      ...mockUser,
      activeGuess: null
    });
  });
});
