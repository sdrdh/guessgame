<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { confirmSignUp, resendSignUpCode, autoSignIn } from 'aws-amplify/auth';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Alert from '$lib/components/ui/alert';

	// Get email and password from URL params (passed from signup)
	let email = $state('');
	let code = $state('');
	let error = $state('');
	let success = $state('');
	let loading = $state(false);
	let resending = $state(false);

	onMount(() => {
		// Get email from URL params
		const params = new URLSearchParams(window.location.search);
		const emailParam = params.get('email');
		if (emailParam) {
			email = emailParam;
		}
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		success = '';
		loading = true;

		try {
			// Confirm the sign up
			await confirmSignUp({
				username: email,
				confirmationCode: code
			});

			success = 'Email verified successfully! Redirecting to login...';

			// Try to auto sign in if available
			try {
				await autoSignIn();
				setTimeout(() => goto('/'), 1500);
			} catch {
				// If auto sign-in fails, redirect to login page
				setTimeout(() => goto('/login'), 1500);
			}
		} catch (err: any) {
			console.error('Verification error:', err);
			if (err.name === 'CodeMismatchException') {
				error = 'Invalid verification code. Please try again.';
			} else if (err.name === 'ExpiredCodeException') {
				error = 'Verification code has expired. Please request a new one.';
			} else {
				error = err.message || 'Verification failed';
			}
		} finally {
			loading = false;
		}
	}

	async function handleResendCode() {
		if (!email) {
			error = 'Email is required to resend code';
			return;
		}

		error = '';
		success = '';
		resending = true;

		try {
			await resendSignUpCode({ username: email });
			success = 'Verification code sent! Check your email.';
		} catch (err: any) {
			console.error('Resend error:', err);
			error = err.message || 'Failed to resend code';
		} finally {
			resending = false;
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<Card.Root>
			<Card.Header class="text-center">
				<Card.Title class="text-3xl mb-2">Verify Your Email</Card.Title>
				<Card.Description>
					Enter the verification code sent to your email
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
							disabled={!!email}
						/>
					</div>

					<div class="space-y-2">
						<Label for="code">Verification Code</Label>
						<Input
							id="code"
							type="text"
							bind:value={code}
							required
							placeholder="123456"
						/>
						<p class="text-xs text-muted-foreground">
							Enter the 6-digit code from your email
						</p>
					</div>

					{#if error}
						<Alert.Root variant="destructive">
							<Alert.Description>{error}</Alert.Description>
						</Alert.Root>
					{/if}

					{#if success}
						<Alert.Root class="border-green-600 bg-green-50 text-green-900">
							<Alert.Description>{success}</Alert.Description>
						</Alert.Root>
					{/if}

					<Button type="submit" disabled={loading} class="w-full">
						{loading ? 'Verifying...' : 'Verify Email'}
					</Button>
				</form>

				<div class="mt-4 text-center space-y-2">
					<p class="text-sm text-muted-foreground">Didn't receive the code?</p>
					<Button
						type="button"
						variant="outline"
						onclick={handleResendCode}
						disabled={resending || !email}
						class="w-full"
					>
						{resending ? 'Resending...' : 'Resend Code'}
					</Button>
				</div>

				<div class="mt-4 text-center">
					<Button type="button" variant="link" onclick={() => goto('/login')}>
						Back to Login
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
