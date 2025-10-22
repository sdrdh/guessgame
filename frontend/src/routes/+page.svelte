<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { gameStore } from '$lib/stores/game.svelte';
	import { authStore } from '$lib/stores/auth.svelte';

	onMount(async () => {
		// Initialize game store
		await gameStore.init();
	});

	onDestroy(() => {
		// Cleanup subscriptions
		gameStore.cleanup();
	});

	async function handleGuess(direction: 'up' | 'down') {
		try {
			await gameStore.makeGuess(direction);
		} catch (err) {
			console.error('Failed to make guess:', err);
		}
	}

	async function handleLogout() {
		await authStore.logout();
		gameStore.reset();
		goto('/login');
	}

	function formatTime(timestamp: number) {
		return new Date(timestamp * 1000).toLocaleTimeString();
	}

	function formatPrice(price: number) {
		return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<div class="container mx-auto p-6 max-w-2xl">
	<!-- Header -->
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold">Bitcoin Guessing Game</h1>
		<button class="btn btn-ghost btn-sm" onclick={handleLogout}>
			Logout
		</button>
	</div>

	{#if gameStore.error}
		<div class="alert alert-error mb-4">
			<span>{gameStore.error}</span>
		</div>
	{/if}

	<!-- Current Price Card -->
	<div class="card bg-base-200 shadow-xl mb-4">
		<div class="card-body">
			<h2 class="text-sm opacity-70 mb-2">Current BTC Price</h2>
			{#if gameStore.currentPrice > 0}
				<p class="text-4xl font-bold">${formatPrice(gameStore.currentPrice)}</p>
				<p class="text-xs opacity-60 mt-1">Live price updates</p>
			{:else}
				<p class="text-4xl font-bold opacity-50">Loading...</p>
			{/if}
		</div>
	</div>

	<!-- Score Card -->
	<div class="card bg-base-200 shadow-xl mb-4">
		<div class="card-body">
			<h2 class="text-sm opacity-70 mb-2">Your Score</h2>
			<p class="text-3xl font-bold">{gameStore.score}</p>
		</div>
	</div>

	<!-- Active Guess or Guess Buttons -->
	{#if gameStore.hasActiveGuess && gameStore.activeGuess}
		<div class="card bg-base-200 shadow-xl mb-4">
			<div class="card-body">
				<h3 class="card-title mb-4">Active Guess</h3>
				<div class="space-y-2">
					<div class="flex justify-between">
						<span class="opacity-70">Direction:</span>
						<span class="font-semibold uppercase">
							{gameStore.activeGuess.direction}
							{gameStore.activeGuess.direction === 'up' ? '⬆️' : '⬇️'}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="opacity-70">Start Price:</span>
						<span class="font-semibold">${formatPrice(gameStore.activeGuess.startPrice)}</span>
					</div>
					<div class="flex justify-between">
						<span class="opacity-70">Status:</span>
						<span class="badge badge-warning">Resolving...</span>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<h3 class="card-title mb-4">Make Your Guess</h3>
				<div class="grid grid-cols-2 gap-4">
					<button
						class="btn btn-primary btn-lg text-xl"
						onclick={() => handleGuess('up')}
						disabled={gameStore.isLoading}
					>
						<span class="mr-2">⬆️</span> UP
					</button>
					<button
						class="btn btn-secondary btn-lg text-xl"
						onclick={() => handleGuess('down')}
						disabled={gameStore.isLoading}
					>
						<span class="mr-2">⬇️</span> DOWN
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Recent Guesses History -->
	<div class="card bg-base-200 shadow-xl mt-4">
		<div class="card-body">
			<h3 class="card-title mb-4">Recent Guesses</h3>
			{#if gameStore.guessHistory.length > 0}
				<div class="space-y-3">
					{#each gameStore.guessHistory as guess (guess.guessId)}
						{#if guess.resolved && guess.endPrice}
							<div class="flex items-center justify-between p-3 bg-base-300 rounded-lg">
								<div class="flex items-center gap-3">
									{#if guess.correct}
										<span class="badge badge-success">✅ WIN</span>
									{:else}
										<span class="badge badge-error">❌ LOSS</span>
									{/if}
									<span class="font-semibold uppercase">
										{guess.direction} {guess.direction === 'up' ? '⬆️' : '⬇️'}
									</span>
								</div>
								<div class="text-right text-sm">
									<div class="font-mono">
										${formatPrice(guess.startPrice)} → ${formatPrice(guess.endPrice)}
									</div>
									{#if guess.resolvedAt}
										<div class="opacity-60">{formatTime(guess.resolvedAt)}</div>
									{/if}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{:else}
				<p class="text-center opacity-60 py-4">No guesses yet. Make your first guess above!</p>
			{/if}
		</div>
	</div>
</div>
