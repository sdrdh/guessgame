<script lang="ts">
	let currentPrice = 45234.56;
	let score = 0;
	let activeGuess: any = null;
	let hasActiveGuess = false;

	function handleGuess(direction: 'up' | 'down') {
		hasActiveGuess = true;
		activeGuess = {
			direction,
			startPrice: currentPrice,
			startTime: Date.now()
		};
		console.log(`Guess: ${direction}`);
	}
</script>

<div class="container mx-auto p-6 max-w-2xl">
	<!-- Header -->
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold">Bitcoin Guessing Game</h1>
		<button class="btn btn-ghost btn-sm">
			Logout
		</button>
	</div>

	<!-- Current Price Card -->
	<div class="card bg-base-200 shadow-xl mb-4">
		<div class="card-body">
			<h2 class="text-sm opacity-70 mb-2">Current BTC Price</h2>
			<p class="text-4xl font-bold">${currentPrice.toLocaleString()}</p>
			<p class="text-xs opacity-60 mt-1">Updated 2s ago</p>
		</div>
	</div>

	<!-- Score Card -->
	<div class="card bg-base-200 shadow-xl mb-4">
		<div class="card-body">
			<h2 class="text-sm opacity-70 mb-2">Your Score</h2>
			<p class="text-3xl font-bold">{score}</p>
		</div>
	</div>

	<!-- Active Guess or Guess Buttons -->
	{#if hasActiveGuess && activeGuess}
		<div class="card bg-base-200 shadow-xl mb-4">
			<div class="card-body">
				<h3 class="card-title mb-4">Active Guess</h3>
				<div class="space-y-2">
					<div class="flex justify-between">
						<span class="opacity-70">Direction:</span>
						<span class="font-semibold uppercase">
							{activeGuess.direction}
							{activeGuess.direction === 'up' ? '⬆️' : '⬇️'}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="opacity-70">Start Price:</span>
						<span class="font-semibold">${activeGuess.startPrice.toLocaleString()}</span>
					</div>
					<div class="flex justify-between">
						<span class="opacity-70">Status:</span>
						<span class="badge badge-warning">Resolving...</span>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<h3 class="card-title mb-4">Make Your Guess</h3>
				<div class="grid grid-cols-2 gap-4">
					<button
						class="btn btn-primary btn-lg text-xl"
						onclick={() => handleGuess('up')}
					>
						<span class="mr-2">⬆️</span> UP
					</button>
					<button
						class="btn btn-secondary btn-lg text-xl"
						onclick={() => handleGuess('down')}
					>
						<span class="mr-2">⬇️</span> DOWN
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Dummy History -->
	<div class="card bg-base-200 shadow-xl mt-4">
		<div class="card-body">
			<h3 class="card-title mb-4">Recent Guesses</h3>
			<div class="space-y-3">
				<!-- Win Example -->
				<div class="flex items-center justify-between p-3 bg-base-300 rounded-lg">
					<div class="flex items-center gap-3">
						<span class="badge badge-success">✅ WIN</span>
						<span class="font-semibold uppercase">UP ⬆️</span>
					</div>
					<div class="text-right text-sm">
						<div class="font-mono">$45,100.00 → $45,250.00</div>
						<div class="opacity-60">2:45 PM</div>
					</div>
				</div>

				<!-- Loss Example -->
				<div class="flex items-center justify-between p-3 bg-base-300 rounded-lg">
					<div class="flex items-center gap-3">
						<span class="badge badge-error">❌ LOSS</span>
						<span class="font-semibold uppercase">DOWN ⬇️</span>
					</div>
					<div class="text-right text-sm">
						<div class="font-mono">$45,250.00 → $45,300.00</div>
						<div class="opacity-60">2:43 PM</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
