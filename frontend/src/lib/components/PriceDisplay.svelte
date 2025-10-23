<script lang="ts">
	import * as Card from '$lib/components/ui/card';

	interface Props {
		currentPrice: number;
		priceLastUpdated: string | null;
	}

	let { currentPrice, priceLastUpdated }: Props = $props();

	function formatPrice(price: number) {
		return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<Card.Root class="mb-4">
	<Card.Content class="pt-6">
		<h2 class="text-sm text-muted-foreground mb-2">Current BTC Price</h2>
		{#if currentPrice > 0}
			<p class="text-4xl font-bold">${formatPrice(currentPrice)}</p>
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
