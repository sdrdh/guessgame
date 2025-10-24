<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Alert from '$lib/components/ui/alert';

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let isSignUp = $state(false);
	let error = $state('');
	let loading = $state(false);
	let passwordError = $state('');

	onMount(() => {
		// If already authenticated, redirect to home
		if (authStore.isAuthenticated) {
			goto('/');
		}
	});

	// Calculate password strength
	function getPasswordStrength(): { level: 'weak' | 'medium' | 'strong'; label: string; color: string; width: string } {
		if (!password || !isSignUp) {
			return { level: 'weak', label: '', color: '', width: '0%' };
		}

		let strength = 0;
		const hasLength = password.length >= 8;
		const hasNumber = /\d/.test(password);
		const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

		if (hasLength) strength++;
		if (hasNumber) strength++;
		if (hasSpecial) strength++;

		if (strength === 3) {
			return { level: 'strong', label: 'Strong', color: 'bg-green-500', width: '100%' };
		} else if (strength === 2) {
			return { level: 'medium', label: 'Medium', color: 'bg-yellow-500', width: '66%' };
		} else if (password.length > 0) {
			return { level: 'weak', label: 'Weak', color: 'bg-red-500', width: '33%' };
		}

		return { level: 'weak', label: '', color: '', width: '0%' };
	}

	function validatePassword() {
		if (!isSignUp) {
			passwordError = '';
			return true;
		}

		if (password.length < 8) {
			passwordError = 'Password must be at least 8 characters';
			return false;
		}

		if (!/\d/.test(password)) {
			passwordError = 'Password must contain at least one number';
			return false;
		}

		if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
			passwordError = 'Password must contain at least one special character';
			return false;
		}

		if (password !== confirmPassword) {
			passwordError = 'Passwords do not match';
			return false;
		}

		passwordError = '';
		return true;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = '';

		if (!validatePassword()) {
			return;
		}

		loading = true;

		try {
			let result;
			if (isSignUp) {
				result = await authStore.register(email, password);
			} else {
				result = await authStore.login(email, password);
			}

			if (result.success) {
				await goto('/');
			} else if ('requiresConfirmation' in result && result.requiresConfirmation) {
				// Redirect to verification page with email
				await goto(`/verify?email=${encodeURIComponent(email)}`);
			} else if ('error' in result && result.error) {
				error = result.error;
			} else {
				error = 'Authentication failed';
			}
		} catch (err: any) {
			error = err.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	function toggleMode() {
		isSignUp = !isSignUp;
		confirmPassword = '';
		passwordError = '';
		error = '';
	}
</script>

<div class="min-h-screen flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<Card.Root>
			<Card.Header class="text-center">
				<Card.Title class="text-3xl mb-2">Bitcoin Guessing Game</Card.Title>
				<Card.Description>
					{isSignUp ? 'Create an account to start playing' : 'Sign in to your account'}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<form onsubmit={handleSubmit} class="space-y-4">
					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input
							id="email"
							type="email"
							bind:value={email}
							required
							placeholder="you@example.com"
						/>
					</div>

					<div class="space-y-2">
						<Label for="password">Password</Label>
						<Input
							id="password"
							type="password"
							bind:value={password}
							required
							placeholder="••••••••"
						/>
						{#if isSignUp && password}
							{@const strength = getPasswordStrength()}
							<div class="space-y-1">
								<div class="h-2 bg-gray-200 rounded-full overflow-hidden">
									<div
										class="h-full {strength.color} transition-all duration-300"
										style="width: {strength.width}"
									></div>
								</div>
								{#if strength.label}
									<p class="text-xs font-medium {strength.level === 'strong' ? 'text-green-600' : strength.level === 'medium' ? 'text-yellow-600' : 'text-red-600'}">
										{strength.label}
									</p>
								{/if}
							</div>
						{/if}
					</div>

					{#if isSignUp}
						<div class="space-y-2">
							<Label for="confirmPassword">Confirm Password</Label>
							<Input
								id="confirmPassword"
								type="password"
								bind:value={confirmPassword}
								required
								placeholder="••••••••"
								oninput={validatePassword}
							/>
							{#if passwordError}
								<p class="text-sm text-destructive">{passwordError}</p>
							{/if}
							<p class="text-xs text-muted-foreground">
								Password must be at least 8 characters with a number and special character
							</p>
						</div>
					{/if}

					{#if error}
						<Alert.Root variant="destructive">
							<Alert.Description>{error}</Alert.Description>
						</Alert.Root>
					{/if}

					<Button
						type="submit"
						disabled={loading || (isSignUp && !!passwordError)}
						class="w-full"
					>
						{loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
					</Button>
				</form>

				<div class="relative my-4">
					<div class="absolute inset-0 flex items-center">
						<span class="w-full border-t"></span>
					</div>
					<div class="relative flex justify-center text-xs uppercase">
						<span class="bg-card px-2 text-muted-foreground">Or</span>
					</div>
				</div>

				<div class="text-center">
					<Button
						type="button"
						variant="link"
						onclick={toggleMode}
					>
						{isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
