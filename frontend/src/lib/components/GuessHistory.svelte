<script lang="ts">
	import * as Card from '$lib/components/ui/card';

	interface GuessHistoryItem {
		guessId: string;
		instrument: string;
		direction: 'up' | 'down';
		startPrice: number;
		endPrice?: number;
		resolved: boolean;
		correct?: boolean;
		resolvedAt?: number;
	}

	interface Props {
		history: GuessHistoryItem[];
	}

	let { history }: Props = $props();

	function formatTime(timestamp: number) {
		return new Date(timestamp * 1000).toLocaleTimeString();
	}

	function formatPrice(price: number) {
		return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<Card.Root class="mt-4">
	<Card.Header>
		<Card.Title>Recent Guesses</Card.Title>
	</Card.Header>
	<Card.Content>
		{#if history.length > 0}
			<div class="space-y-3">
				{#each history as guess (guess.guessId)}
					{#if guess.resolved && guess.endPrice}
						<div class="flex items-center justify-between p-3 rounded-lg {guess.correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}">
							<div class="flex items-center gap-3">
								<div>
									<div class="text-xs text-muted-foreground font-medium">
										{guess.instrument}
									</div>
									<span class="font-semibold uppercase">
										{guess.direction} {guess.direction === 'up' ? '⬆️' : '⬇️'}
									</span>
								</div>
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
