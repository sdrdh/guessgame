<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { gameStore } from '$lib/stores/game.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import * as Alert from '$lib/components/ui/alert';

	// Import our new components
	import Header from '$lib/components/Header.svelte';
	import PriceDisplay from '$lib/components/PriceDisplay.svelte';
	import ScoreCard from '$lib/components/ScoreCard.svelte';
	import ActiveGuess from '$lib/components/ActiveGuess.svelte';
	import GuessButtons from '$lib/components/GuessButtons.svelte';
	import GuessHistory from '$lib/components/GuessHistory.svelte';

	onMount(async () => {
		await gameStore.init();
	});

	onDestroy(() => {
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
</script>

<div class="container mx-auto p-6 max-w-6xl">
	<Header onLogout={handleLogout} />

	{#if gameStore.error}
		<Alert.Root variant="destructive" class="mb-4">
			<Alert.Description>{gameStore.error}</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		<!-- Left column: Main game area (2/3 width on md+) -->
		<div class="md:col-span-2 space-y-4">
			<PriceDisplay
				currentPrice={gameStore.currentPrice}
				priceLastUpdated={gameStore.priceLastUpdated}
			/>

			<ScoreCard score={gameStore.score} />

			{#if gameStore.hasActiveGuess}
				<ActiveGuess
					guess={gameStore.activeGuess}
					timeUntilResolution={gameStore.timeUntilResolution}
				/>
			{/if}

			<GuessButtons
				onGuess={handleGuess}
				disabled={gameStore.hasActiveGuess}
				isLoading={gameStore.isLoading}
			/>
		</div>

		<!-- Right column: Guess history (1/3 width on md+) -->
		<div class="md:col-span-1">
			<GuessHistory history={gameStore.guessHistory} />
		</div>
	</div>
</div>
