import { PostConfirmationTriggerEvent, PostConfirmationTriggerHandler } from 'aws-lambda';
import { createUser } from '../shared/db';

/**
 * Cognito Post-Confirmation Trigger
 *
 * This Lambda is triggered automatically after a user confirms their email.
 * It creates a user profile in DynamoDB with their email and initial score of 0.
 *
 * Trigger flow:
 * User signs up → Confirms email → This Lambda → User profile created in DynamoDB
 */
export const handler: PostConfirmationTriggerHandler = async (
  event: PostConfirmationTriggerEvent
): Promise<PostConfirmationTriggerEvent> => {
  console.log('🎯 Post-confirmation trigger event:', JSON.stringify(event, null, 2));

  const { userPoolId, userName } = event;
  const { email } = event.request.userAttributes;

  // userName is the user's sub (UUID)
  const userId = userName;

  if (!email) {
    console.error('❌ No email found in user attributes');
    // Don't throw error - this would prevent user confirmation
    // Just log and return event
    return event;
  }

  try {
    console.log(`✅ Creating user profile for: ${userId} (${email})`);
    await createUser(userId, email);
    console.log(`✅ User profile created successfully in DynamoDB`);
  } catch (error) {
    console.error('❌ Error creating user profile:', error);
    // Don't throw error - this would prevent user confirmation
    // The user can still be created later if needed
  }

  // IMPORTANT: Always return the event object
  return event;
};
