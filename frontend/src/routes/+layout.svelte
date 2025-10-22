<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { configureAmplify } from '$lib/aws-config';
	import '../app.css';

	let { children } = $props();

	// Configure Amplify immediately (before anything else)
	if (typeof window !== 'undefined') {
		configureAmplify();
	}

	// Initialize auth on mount
	onMount(async () => {
		await authStore.init();
	});

	// Protect routes that require authentication
	$effect(() => {
		const publicRoutes = ['/login'];
		const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

		// Wait for auth to be initialized
		if (!authStore.isLoading) {
			if (!authStore.isAuthenticated && !publicRoutes.includes(currentPath)) {
				goto('/login');
			}
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
