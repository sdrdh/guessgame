<script lang="ts">
	import * as Card from '$lib/components/ui/card';

	interface Props {
		currentPrice: number;
		priceLastUpdated: string | null;
	}

	let { currentPrice, priceLastUpdated }: Props = $props();

	// Track previous price and animation state
	let previousPrice = $state<number>(0);
	let priceChangeClass = $state<string>('');

	// Watch for price changes and trigger animation
	$effect(() => {
		// Skip on initial load (when previousPrice is 0)
		if (previousPrice > 0 && currentPrice !== previousPrice) {
			// Determine if price went up or down
			const changeClass = currentPrice > previousPrice
				? 'text-green-500'
				: 'text-red-500';

			priceChangeClass = changeClass;

			// Reset animation after 500ms
			const timer = setTimeout(() => {
				priceChangeClass = '';
			}, 500);

			return () => clearTimeout(timer);
		}

		// Update previous price for next comparison
		previousPrice = currentPrice;
	});

	function formatPrice(price: number) {
		return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<Card.Root class="mb-4">
	<Card.Content class="pt-6">
		<h2 class="text-sm text-muted-foreground mb-2">Current BTC Price</h2>
		{#if currentPrice > 0}
			<p class="text-4xl font-bold transition-colors duration-500 {priceChangeClass}">${formatPrice(currentPrice)}</p>
			{#if priceLastUpdated}
				<p class="text-xs text-muted-foreground mt-1">Updated {priceLastUpdated}</p>
			{:else}
				<p class="text-xs text-muted-foreground mt-1">Live price updates</p>
			{/if}
		{:else}
			<p class="text-4xl font-bold text-muted-foreground">Loading...</p>
		{/if}
	</Card.Content>
</Card.Root>
