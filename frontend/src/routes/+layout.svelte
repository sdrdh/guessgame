<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	// Dummy auth check - will integrate with Cognito later
	let isAuthenticated = false;

	$effect(() => {
		if (!isAuthenticated && $page.url.pathname !== '/login') {
			goto('/login');
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
