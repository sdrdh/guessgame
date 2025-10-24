import { PostConfirmationTriggerEvent, PostConfirmationTriggerHandler } from 'aws-lambda';
import { createUser } from '../shared/db';
import { logger, tracer, wrapHandler } from '../shared/powertools';

/**
 * Cognito Post-Confirmation Trigger
 *
 * This Lambda is triggered automatically after a user confirms their email.
 * It creates a user profile in DynamoDB with their email and initial score of 0.
 *
 * Trigger flow:
 * User signs up → Confirms email → This Lambda → User profile created in DynamoDB
 */
const lambdaHandler = async (
  event: PostConfirmationTriggerEvent
): Promise<PostConfirmationTriggerEvent> => {
  logger.info('Post-confirmation trigger invoked', {
    userPoolId: event.userPoolId,
    triggerSource: event.triggerSource
  });

  const { userPoolId, userName } = event;
  const { email } = event.request.userAttributes;

  // userName is the user's sub (UUID)
  const userId = userName;

  logger.appendKeys({ userId });
  tracer.putAnnotation('userId', userId);
  tracer.putAnnotation('userPoolId', userPoolId);

  if (!email) {
    logger.error('No email found in user attributes', { userId });
    // Don't throw error - this would prevent user confirmation
    // Just log and return event
    return event;
  }

  try {
    logger.info('Creating user profile', { userId });
    await createUser(userId, email);
    logger.info('User profile created successfully', { userId });

    tracer.putMetadata('userCreation', {
      userId,
      success: true
    });
  } catch (error) {
    logger.error('Error creating user profile', { error, userId });
    // Don't throw error - this would prevent user confirmation
    // The user can still be created later if needed

    tracer.putMetadata('userCreation', {
      userId,
      success: false,
      error: (error as Error).message
    });
  }

  // IMPORTANT: Always return the event object
  return event;
};

export const handler = wrapHandler(lambdaHandler) as PostConfirmationTriggerHandler;
