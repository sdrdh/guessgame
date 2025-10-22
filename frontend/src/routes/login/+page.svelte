<script lang="ts">
	import { goto } from '$app/navigation';

	let email = '';
	let password = '';
	let isSignUp = false;
	let error = '';
	let loading = false;

	async function handleSubmit() {
		error = '';
		loading = true;

		try {
			if (isSignUp) {
				console.log('Sign up:', email);
				// Will integrate with Cognito later
			} else {
				console.log('Login:', email);
				// Will integrate with Cognito later
			}

			// Dummy navigation
			await goto('/');
		} catch (err: any) {
			error = err.message;
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

				<form on:submit|preventDefault={handleSubmit} class="space-y-4">
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
						on:click={() => isSignUp = !isSignUp}
						class="link link-primary"
					>
						{isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
