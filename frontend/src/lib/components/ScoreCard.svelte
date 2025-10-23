<script lang="ts">
	import * as Card from '$lib/components/ui/card';

	interface Props {
		score: number;
	}

	let { score }: Props = $props();
</script>

<Card.Root class="mb-4">
	<Card.Content class="pt-6">
		<h2 class="text-sm text-muted-foreground mb-2">Your Score</h2>
		<p class="text-3xl font-bold">{score}</p>
	</Card.Content>
</Card.Root>
