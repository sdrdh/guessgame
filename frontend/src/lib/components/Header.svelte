<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	interface Props {
		onLogout: () => void;
	}

	let { onLogout }: Props = $props();
</script>

<div class="flex justify-between items-center mb-6">
	<h1 class="text-3xl font-bold">Bitcoin Guessing Game</h1>
	<Button variant="ghost" size="sm" onclick={onLogout}>
		Logout
	</Button>
</div>
