<script lang="ts">
	let { data, form } = $props();

	function percent(done: number, total: number) {
		return total === 0 ? 0 : Math.round((done / total) * 100);
	}

	function statusLabel(status: string) {
		return status
			.split('-')
			.map((part) => part[0].toUpperCase() + part.slice(1))
			.join(' ');
	}
</script>

<svelte:head>
	<title>Astryx</title>
	<meta
		name="description"
		content="Local video game completion tracker with checklist and calendar JSON files."
	/>
</svelte:head>

<main class="min-h-screen bg-zinc-950 text-zinc-100">
	<section class="border-b border-zinc-800 bg-zinc-950/95">
		<div class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
			<div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<div>
					<p class="text-sm font-medium uppercase tracking-wide text-emerald-300">Astryx</p>
					<h1 class="mt-1 text-3xl font-semibold tracking-normal text-white">Select a game</h1>
				</div>
				<div class="grid grid-cols-3 gap-2 text-sm">
					<div class="border border-zinc-800 bg-zinc-900 px-3 py-2">
						<p class="text-zinc-400">Games</p>
						<p class="text-xl font-semibold">{data.library.length}</p>
					</div>
					<div class="border border-zinc-800 bg-zinc-900 px-3 py-2">
						<p class="text-zinc-400">Active</p>
						<p class="text-xl font-semibold">
							{data.library.filter((game) => game.status === 'playing').length}
						</p>
					</div>
					<div class="border border-zinc-800 bg-zinc-900 px-3 py-2">
						<p class="text-zinc-400">Done</p>
						<p class="text-xl font-semibold">
							{data.library.reduce((sum, game) => sum + game.completed, 0)}/{data.library.reduce(
								(sum, game) => sum + game.total,
								0
							)}
						</p>
					</div>
				</div>
			</div>

			<form method="POST" action="?/addGame" class="grid gap-3 border border-zinc-800 bg-zinc-900 p-3 md:grid-cols-[2fr_1fr_auto]">
				<input
					class="min-w-0 border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
					name="title"
					placeholder="Game title"
					required
				/>
				<input
					class="min-w-0 border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
					name="platform"
					placeholder="Platform"
					required
				/>
				<button class="bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-300">
					Add game
				</button>
			</form>

			{#if form?.message}
				<p class="border border-red-500/50 bg-red-950 px-3 py-2 text-sm text-red-100">{form.message}</p>
			{/if}
		</div>
	</section>

	<section class="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
		{#each data.library as game}
			<a class="block border border-zinc-800 bg-zinc-900 p-4 hover:border-emerald-500/70 hover:bg-zinc-900/80" href={`/${game.id}`}>
				<div class="flex flex-wrap items-center gap-2">
					<h2 class="text-xl font-semibold text-white">{game.title}</h2>
					<span class="border border-zinc-700 px-2 py-1 text-xs text-zinc-300">{game.platform}</span>
				</div>
				<p class="mt-2 text-sm text-zinc-400">{game.completed} of {game.total} tasks complete</p>
				<div class="mt-3 h-2 bg-zinc-800">
					<div class="h-full bg-emerald-400" style={`width: ${percent(game.completed, game.total)}%`}></div>
				</div>
				<div class="mt-4 flex items-center justify-between gap-3 text-sm">
					<span class="border border-zinc-700 px-2 py-1 text-zinc-300">{statusLabel(game.status)}</span>
					<span class="text-emerald-200">{percent(game.completed, game.total)}%</span>
				</div>
			</a>
		{/each}
	</section>
</main>
