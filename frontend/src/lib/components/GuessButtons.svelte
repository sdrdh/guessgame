<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		onGuess: (direction: 'up' | 'down') => void;
		disabled: boolean;
		isLoading: boolean;
	}

	let { onGuess, disabled, isLoading }: Props = $props();
</script>

<Card.Root class="mb-4">
	<Card.Header>
		<Card.Title>Make Your Guess</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="grid grid-cols-2 gap-4">
			<Button
				size="lg"
				class="text-xl bg-green-600 hover:bg-green-700 text-white"
				onclick={() => onGuess('up')}
				disabled={isLoading || disabled}
			>
				<span class="mr-2">⬆️</span> UP
			</Button>
			<Button
				size="lg"
				class="text-xl bg-red-600 hover:bg-red-700 text-white"
				onclick={() => onGuess('down')}
				disabled={isLoading || disabled}
			>
				<span class="mr-2">⬇️</span> DOWN
			</Button>
		</div>
	</Card.Content>
</Card.Root>
