<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { gameStore } from '$lib/stores/game.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import * as Alert from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';

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
		<Button variant="ghost" size="sm" onclick={handleLogout}>
			Logout
		</Button>
	</div>

	{#if gameStore.error}
		<Alert.Root variant="destructive" class="mb-4">
			<Alert.Description>{gameStore.error}</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Current Price Card -->
	<Card.Root class="mb-4">
		<Card.Content class="pt-6">
			<h2 class="text-sm text-muted-foreground mb-2">Current BTC Price</h2>
			{#if gameStore.currentPrice > 0}
				<p class="text-4xl font-bold">${formatPrice(gameStore.currentPrice)}</p>
				{#if gameStore.priceLastUpdated}
					<p class="text-xs text-muted-foreground mt-1">Updated {gameStore.priceLastUpdated}</p>
				{:else}
					<p class="text-xs text-muted-foreground mt-1">Live price updates</p>
				{/if}
			{:else}
				<p class="text-4xl font-bold text-muted-foreground">Loading...</p>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Score Card -->
	<Card.Root class="mb-4">
		<Card.Content class="pt-6">
			<h2 class="text-sm text-muted-foreground mb-2">Your Score</h2>
			<p class="text-3xl font-bold">{gameStore.score}</p>
		</Card.Content>
	</Card.Root>

	<!-- Active Guess Info -->
	{#if gameStore.hasActiveGuess && gameStore.activeGuess}
		<Card.Root class="mb-4">
			<Card.Header>
				<Card.Title>Active Guess</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="space-y-2">
					<div class="flex justify-between">
						<span class="text-muted-foreground">Direction:</span>
						<span class="font-semibold uppercase">
							{gameStore.activeGuess.direction}
							{gameStore.activeGuess.direction === 'up' ? '⬆️' : '⬇️'}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Start Price:</span>
						<span class="font-semibold">${formatPrice(gameStore.activeGuess.startPrice)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Status:</span>
						{#if gameStore.timeUntilResolution}
							{@const seconds = gameStore.timeUntilResolution.includes('in ')
								? parseInt(gameStore.timeUntilResolution.match(/\d+/)?.[0] || '0')
								: 0}
							<Badge
								variant="secondary"
								class={seconds > 0 && seconds <= 10 ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}
							>
								{gameStore.timeUntilResolution}
							</Badge>
						{:else}
							<Badge variant="secondary">Resolving...</Badge>
						{/if}
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Guess Buttons -->
	<Card.Root class="mb-4">
		<Card.Header>
			<Card.Title>Make Your Guess</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="grid grid-cols-2 gap-4">
				<Button
					size="lg"
					class="text-xl bg-green-600 hover:bg-green-700 text-white"
					onclick={() => handleGuess('up')}
					disabled={gameStore.isLoading || gameStore.hasActiveGuess}
				>
					<span class="mr-2">⬆️</span> UP
				</Button>
				<Button
					size="lg"
					class="text-xl bg-red-600 hover:bg-red-700 text-white"
					onclick={() => handleGuess('down')}
					disabled={gameStore.isLoading || gameStore.hasActiveGuess}
				>
					<span class="mr-2">⬇️</span> DOWN
				</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Recent Guesses History -->
	<Card.Root class="mt-4">
		<Card.Header>
			<Card.Title>Recent Guesses</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if gameStore.guessHistory.length > 0}
				<div class="space-y-3">
					{#each gameStore.guessHistory as guess (guess.guessId)}
						{#if guess.resolved && guess.endPrice}
							<div class="flex items-center justify-between p-3 rounded-lg {guess.correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}">
								<div class="flex items-center gap-3">
									<span class="font-semibold uppercase">
										{guess.direction} {guess.direction === 'up' ? '⬆️' : '⬇️'}
									</span>
								</div>
								<div class="text-right text-sm">
									<div class="font-mono">
										${formatPrice(guess.startPrice)} → ${formatPrice(guess.endPrice)}
									</div>
									{#if guess.resolvedAt}
										<div class="text-muted-foreground">{formatTime(guess.resolvedAt)}</div>
									{/if}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{:else}
				<p class="text-center text-muted-foreground py-4">No guesses yet. Make your first guess above!</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
