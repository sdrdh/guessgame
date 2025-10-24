import { AppSyncResolverEvent } from 'aws-lambda';
import { getGuessHistory, Guess } from '../shared/db';
import { logger, tracer, wrapHandler } from '../shared/powertools';

interface GetGuessHistoryArgs {
  limit?: number;
}

const lambdaHandler = async (event: AppSyncResolverEvent<GetGuessHistoryArgs>): Promise<Guess[]> => {
  logger.debug('getGuessHistory event received', { eventType: event.info.fieldName });

  // Get userId from Cognito token
  const identity = event.identity as any;
  const userId = identity?.claims?.sub;
  if (!userId) {
    throw new Error('Unauthorized: No user ID in token');
  }

  const limit = event.arguments?.limit || 10;

  logger.appendKeys({ userId });
  tracer.putAnnotation('userId', userId);
  tracer.putAnnotation('limit', limit);

  try {
    const history = await getGuessHistory(userId, limit);
    logger.info('Guess history retrieved', { userId, count: history.length, limit });

    tracer.putMetadata('guessHistory', {
      count: history.length,
      limit
    });

    return history;
  } catch (error) {
    logger.error('Error getting guess history', error as Error);
    throw error;
  }
};

export const handler = wrapHandler(lambdaHandler);
