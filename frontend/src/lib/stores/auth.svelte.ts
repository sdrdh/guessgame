import { signIn, signUp, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

// Auth state using Svelte 5 runes
class AuthStore {
  isAuthenticated = $state<boolean>(false);
  currentUser = $state<any>(null);
  isLoading = $state<boolean>(true);
  error = $state<string | null>(null);

  // Initialize auth state
  async init() {
    try {
      this.isLoading = true;
      const user = await getCurrentUser();
      this.currentUser = user;
      this.isAuthenticated = true;
    } catch (err) {
      this.isAuthenticated = false;
      this.currentUser = null;
    } finally {
      this.isLoading = false;
    }
  }

  // Sign in with email and password
  async login(email: string, password: string) {
    try {
      this.isLoading = true;
      this.error = null;

      const { isSignedIn, nextStep } = await signIn({
        username: email,
        password
      });

      if (isSignedIn) {
        const user = await getCurrentUser();
        this.currentUser = user;
        this.isAuthenticated = true;
        return { success: true };
      } else {
        // Handle multi-step sign-in if needed
        console.log('Next step:', nextStep);
        return { success: false, nextStep };
      }
    } catch (err: any) {
      console.error('Login error:', err);
      this.error = err.message || 'Failed to sign in';
      return { success: false, error: this.error };
    } finally {
      this.isLoading = false;
    }
  }

  // Register new user
  async register(email: string, password: string) {
    try {
      this.isLoading = true;
      this.error = null;

      const { isSignUpComplete, userId, nextStep } = await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email
          }
        }
      });

      if (isSignUpComplete) {
        // Auto-login after successful registration
        return await this.login(email, password);
      } else {
        // Handle multi-step sign-up (e.g., email confirmation)
        console.log('Next step:', nextStep);
        return { success: false, nextStep, requiresConfirmation: true };
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      this.error = err.message || 'Failed to register';
      return { success: false, error: this.error };
    } finally {
      this.isLoading = false;
    }
  }

  // Sign out
  async logout() {
    try {
      this.isLoading = true;
      await signOut();
      this.isAuthenticated = false;
      this.currentUser = null;
    } catch (err: any) {
      console.error('Logout error:', err);
      this.error = err.message || 'Failed to sign out';
    } finally {
      this.isLoading = false;
    }
  }

  // Get current auth session (for debugging)
  async getSession() {
    try {
      const session = await fetchAuthSession();
      return session;
    } catch (err) {
      console.error('Failed to get session:', err);
      return null;
    }
  }

  // Reset auth state
  reset() {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.isLoading = false;
    this.error = null;
  }
}

// Export singleton instance
export const authStore = new AuthStore();
