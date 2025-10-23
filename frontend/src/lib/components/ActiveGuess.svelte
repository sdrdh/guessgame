<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';

	interface Guess {
		guessId: string;
		direction: 'up' | 'down';
		startPrice: number;
		startTime: number;
		instrument: string;
	}

	interface Props {
		guess: Guess | null;
		timeUntilResolution?: string;
	}

	let { guess, timeUntilResolution }: Props = $props();

	function formatPrice(price: number) {
		return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

{#if guess}
	<Card.Root class="mb-4">
		<Card.Header>
			<Card.Title>Active Guess</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="space-y-2">
				<div class="flex justify-between">
					<span class="text-muted-foreground">Direction:</span>
					<span class="font-semibold uppercase">
						{guess.direction}
						{guess.direction === 'up' ? '⬆️' : '⬇️'}
					</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">Start Price:</span>
					<span class="font-semibold">${formatPrice(guess.startPrice)}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">Status:</span>
					{#if timeUntilResolution}
						{@const seconds = timeUntilResolution.includes('in ')
							? parseInt(timeUntilResolution.match(/\d+/)?.[0] || '0')
							: 0}
						<Badge
							variant="secondary"
							class={seconds > 0 && seconds <= 10 ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}
						>
							{timeUntilResolution}
						</Badge>
					{:else}
						<Badge variant="secondary">Resolving...</Badge>
					{/if}
				</div>
			</div>
		</Card.Content>
	</Card.Root>
{/if}
