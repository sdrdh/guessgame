import { AppSyncResolverEvent } from 'aws-lambda';
import { getUser, getActiveGuess, User, Guess } from '../shared/db';

interface UserResponse extends User {
  activeGuess: Guess | null;
}

export const handler = async (event: AppSyncResolverEvent<{}>): Promise<UserResponse | null> => {
  console.log('getUser event:', JSON.stringify(event, null, 2));

  // Get userId from Cognito token
  const identity = event.identity as any;
  const userId = identity?.claims?.sub;
  if (!userId) {
    throw new Error('Unauthorized: No user ID in token');
  }

  try {
    // Get user profile
    const user = await getUser(userId);
    if (!user) {
      console.log(`User not found: ${userId}`);
      return null;
    }

    // Get active guess if exists
    const activeGuess = await getActiveGuess(userId);

    console.log(`User retrieved: ${user.email}, score: ${user.score}, active guess: ${activeGuess ? 'yes' : 'no'}`);

    return {
      ...user,
      activeGuess
    };
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};
