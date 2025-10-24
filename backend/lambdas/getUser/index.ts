import { AppSyncResolverEvent } from 'aws-lambda';
import { getUser, getActiveGuess, User, Guess } from '../shared/db';
import { logger, tracer, wrapHandler } from '../shared/powertools';

interface UserResponse extends User {
  activeGuess: Guess | null;
}

const lambdaHandler = async (event: AppSyncResolverEvent<{}>): Promise<UserResponse | null> => {
  logger.debug('getUser event received', { eventType: event.info.fieldName });

  // Get userId from Cognito token
  const identity = event.identity as any;
  const userId = identity?.claims?.sub;
  if (!userId) {
    throw new Error('Unauthorized: No user ID in token');
  }

  logger.appendKeys({ userId });
  tracer.putAnnotation('userId', userId);

  try {
    // Get user profile
    const user = await getUser(userId);
    if (!user) {
      logger.info('User not found', { userId });
      return null;
    }

    // Get active guess if exists
    const activeGuess = await getActiveGuess(userId);

    logger.info('User retrieved', {
      userId,
      score: user.score,
      hasActiveGuess: !!activeGuess
    });

    tracer.putMetadata('userProfile', {
      score: user.score,
      hasActiveGuess: !!activeGuess
    });

    return {
      ...user,
      activeGuess
    };
  } catch (error) {
    logger.error('Error getting user', error as Error);
    throw error;
  }
};

export const handler = wrapHandler(lambdaHandler);
