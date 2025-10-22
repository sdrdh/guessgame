import { AppSyncResolverEvent } from 'aws-lambda';
import { getGuessHistory, Guess } from '../shared/db';

interface GetGuessHistoryArgs {
  limit?: number;
}

export const handler = async (event: AppSyncResolverEvent<GetGuessHistoryArgs>): Promise<Guess[]> => {
  console.log('getGuessHistory event:', JSON.stringify(event, null, 2));

  // Get userId from Cognito token
  const identity = event.identity as any;
  const userId = identity?.claims?.sub;
  if (!userId) {
    throw new Error('Unauthorized: No user ID in token');
  }

  const limit = event.arguments?.limit || 10;

  try {
    const history = await getGuessHistory(userId, limit);
    console.log(`Retrieved ${history.length} guesses for user ${userId}`);
    return history;
  } catch (error) {
    console.error('Error getting guess history:', error);
    throw error;
  }
};
