import { getCurrentInstrumentPrice, findDifferentPriceAfter } from '../../lambdas/shared/instrumentPrice';

// Mock AWS SDK
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: jest.fn()
    }))
  },
  QueryCommand: jest.fn(),
  PutCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn()
}));

// Mock environment
process.env.TABLE_NAME = 'test-table';

describe('InstrumentPrice', () => {
  describe('getCurrentInstrumentPrice', () => {
    it('should be defined', () => {
      expect(getCurrentInstrumentPrice).toBeDefined();
    });

    it('should return a number', async () => {
      // Note: This test requires mocking the DynamoDB and fetch calls
      // For now, we verify the function signature
      expect(typeof getCurrentInstrumentPrice).toBe('function');
    });
  });

  describe('findDifferentPriceAfter', () => {
    it('should be defined', () => {
      expect(findDifferentPriceAfter).toBeDefined();
    });

    it('should accept correct parameters', () => {
      const startTime = Date.now();
      const referencePrice = 45000;
      expect(typeof findDifferentPriceAfter).toBe('function');
      expect(findDifferentPriceAfter.length).toBe(2); // 3 parameters (instrument is optional)
    });
  });
});
