<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { LogOut } from 'lucide-svelte';
	import { gameStore } from '$lib/stores/game.svelte';

	interface Props {
		onLogout: () => void;
	}

	let { onLogout }: Props = $props();
</script>

<nav class="flex justify-between items-center mb-6 pb-4 border-b">
	<h1 class="text-3xl font-bold">Guess Game</h1>
	<div class="flex items-center gap-4">
		{#if gameStore.user?.email}
			<span class="text-sm text-muted-foreground hidden sm:inline">
				{gameStore.user.email}
			</span>
		{/if}
		<Button variant="outline" size="sm" onclick={onLogout}>
			<LogOut class="w-4 h-4 mr-2" />
			Logout
		</Button>
	</div>
</nav>
