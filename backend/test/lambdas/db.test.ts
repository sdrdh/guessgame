import { getUser, createUser, getActiveGuess, createGuess, updateUserScore, resolveGuess } from '../../lambdas/shared/db';

// Mock AWS SDK
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: jest.fn()
    }))
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  QueryCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn()
}));

process.env.TABLE_NAME = 'test-table';

describe('Database Functions', () => {
  describe('getUser', () => {
    it('should be defined', () => {
      expect(getUser).toBeDefined();
    });

    it('should accept userId parameter', () => {
      expect(getUser.length).toBe(1);
    });
  });

  describe('createUser', () => {
    it('should be defined', () => {
      expect(createUser).toBeDefined();
    });

    it('should accept userId and email parameters', () => {
      expect(createUser.length).toBe(2);
    });
  });

  describe('getActiveGuess', () => {
    it('should be defined', () => {
      expect(getActiveGuess).toBeDefined();
    });
  });

  describe('createGuess', () => {
    it('should be defined', () => {
      expect(createGuess).toBeDefined();
    });
  });

  describe('updateUserScore', () => {
    it('should be defined', () => {
      expect(updateUserScore).toBeDefined();
    });
  });

  describe('resolveGuess', () => {
    it('should be defined', () => {
      expect(resolveGuess).toBeDefined();
    });
  });
});
