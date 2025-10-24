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
		timeUntilResolution: string | null;
	}

	let { guess, timeUntilResolution }: Props = $props();

	const TOTAL_SECONDS = 60;

	// Extract seconds from timeUntilResolution string
	function getSecondsRemaining(): number {
		if (!timeUntilResolution || !timeUntilResolution.includes('in ')) {
			return 0;
		}
		return parseInt(timeUntilResolution.match(/\d+/)?.[0] || '0');
	}

	// Calculate progress percentage (0-100)
	function getProgressPercentage(): number {
		const seconds = getSecondsRemaining();
		return Math.max(0, Math.min(100, (seconds / TOTAL_SECONDS) * 100));
	}

	// Get color class based on time remaining
	function getProgressColor(): string {
		const percentage = getProgressPercentage();
		if (percentage > 66) {
			return 'bg-green-500'; // > 40 seconds
		} else if (percentage > 33) {
			return 'bg-yellow-500'; // 20-40 seconds
		} else if (percentage > 0) {
			return 'bg-red-500'; // < 20 seconds
		}
		return 'bg-gray-300';
	}

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
					<span class="text-muted-foreground">Instrument:</span>
					<span class="font-semibold">{guess.instrument}</span>
				</div>
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

				<!-- Progress bar -->
				<div class="mt-4">
					<div class="flex justify-between items-center mb-2">
						<span class="text-xs text-muted-foreground">Time Remaining</span>
						<span class="text-xs font-mono font-semibold">
							{getSecondsRemaining()}s / {TOTAL_SECONDS}s
						</span>
					</div>
					<div class="h-2 bg-gray-200 rounded-full overflow-hidden">
						<div
							class="{getProgressColor()} h-full transition-all duration-1000 ease-linear"
							style="width: {getProgressPercentage()}%"
						></div>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
{/if}
