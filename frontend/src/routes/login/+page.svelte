<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';

	let email = $state('');
	let password = $state('');
	let isSignUp = $state(false);
	let error = $state('');
	let loading = $state(false);

	onMount(() => {
		// If already authenticated, redirect to home
		if (authStore.isAuthenticated) {
			goto('/');
		}
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
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
				error = 'Please check your email to confirm your account, then sign in.';
				isSignUp = false;
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
</script>

<div class="min-h-screen flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<div class="text-center mb-6">
					<h1 class="text-3xl font-bold mb-2">Bitcoin Guessing Game</h1>
					<p class="opacity-70">
						{isSignUp ? 'Create an account to start playing' : 'Sign in to your account'}
					</p>
				</div>

				<form onsubmit={handleSubmit} class="space-y-4">
					<div class="form-control">
						<label for="email" class="label">
							<span class="label-text">Email</span>
						</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							required
							class="input input-bordered w-full"
							placeholder="you@example.com"
						/>
					</div>

					<div class="form-control">
						<label for="password" class="label">
							<span class="label-text">Password</span>
						</label>
						<input
							id="password"
							type="password"
							bind:value={password}
							required
							class="input input-bordered w-full"
							placeholder="••••••••"
						/>
					</div>

					{#if error}
						<div class="alert alert-error">
							<span>{error}</span>
						</div>
					{/if}

					<button
						type="submit"
						disabled={loading}
						class="btn btn-primary w-full"
					>
						{loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
					</button>
				</form>

				<div class="divider">OR</div>

				<div class="text-center">
					<button
						type="button"
						onclick={() => isSignUp = !isSignUp}
						class="link link-primary"
					>
						{isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
