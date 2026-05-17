<script lang="ts">
	import type { PageData } from './$types';

	let { data, form } = $props();

	type Category = PageData['library'][number]['categories'][number];
	type CalendarCategory = Extract<Category, { layout: 'calendar' }>;

	const statuses = [
		['not-started', 'Not started'],
		['playing', 'Playing'],
		['paused', 'Paused'],
		['completed', 'Completed'],
		['dropped', 'Dropped']
	];

	function percent(done: number, total: number) {
		return total === 0 ? 0 : Math.round((done / total) * 100);
	}

	function categorySummary(category: Category) {
		const items =
			category.layout === 'checklist'
				? category.items
				: category.entries.flatMap((entry) => entry.items);

		return {
			completed: items.filter((item) => item.done).length,
			total: items.length
		};
	}

	function entriesForPeriod(category: CalendarCategory, periodId: string) {
		return new Map(category.entries.filter((entry) => entry.period === periodId).map((entry) => [entry.day, entry]));
	}

	function dayCompletion(entry: CalendarCategory['entries'][number] | undefined) {
		if (!entry || entry.items.length === 0) return 'No tasks';

		const done = entry.items.filter((item) => item.done).length;
		return `${done}/${entry.items.length}`;
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
					<h1 class="mt-1 text-3xl font-semibold tracking-normal text-white">Game progress tracker</h1>
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

			<form method="POST" action="?/addGame" class="grid gap-3 border border-zinc-800 bg-zinc-900 p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
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
				<select
					class="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
					name="status"
				>
					{#each statuses as [value, label]}
						<option value={value}>{label}</option>
					{/each}
				</select>
				<button class="bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-300">
					Add game
				</button>
			</form>

			{#if form?.message}
				<p class="border border-red-500/50 bg-red-950 px-3 py-2 text-sm text-red-100">{form.message}</p>
			{/if}
		</div>
	</section>

	<section class="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
		{#each data.library as game}
			<article class="border border-zinc-800 bg-zinc-900">
				<header class="grid gap-4 border-b border-zinc-800 p-4 lg:grid-cols-[1fr_auto]">
					<div>
						<div class="flex flex-wrap items-center gap-2">
							<h2 class="text-2xl font-semibold text-white">{game.title}</h2>
							<span class="border border-zinc-700 px-2 py-1 text-xs text-zinc-300">{game.platform}</span>
							<span class="border border-emerald-500/40 px-2 py-1 text-xs text-emerald-200">
								{percent(game.completed, game.total)}%
							</span>
						</div>
						<p class="mt-2 text-sm text-zinc-400">{game.completed} of {game.total} tasks complete</p>
						<div class="mt-3 h-2 bg-zinc-800">
							<div class="h-full bg-emerald-400" style={`width: ${percent(game.completed, game.total)}%`}></div>
						</div>
					</div>
					<div class="flex flex-wrap items-start gap-2">
						<form method="POST" action="?/updateGameStatus">
							<input type="hidden" name="gameId" value={game.id} />
							<select
								class="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
								name="status"
								value={game.status}
								onchange={(event) => event.currentTarget.form?.requestSubmit()}
							>
								{#each statuses as [value, label]}
									<option value={value}>{label}</option>
								{/each}
							</select>
						</form>
						<form method="POST" action="?/deleteGame">
							<input type="hidden" name="gameId" value={game.id} />
							<button
								class="border border-red-500/50 px-3 py-2 text-sm text-red-100 hover:bg-red-950"
								formaction="?/deleteGame"
							>
								Delete
							</button>
						</form>
					</div>
				</header>

				<div class="grid gap-4 p-4">
					<form method="POST" action="?/addCategory" class="grid gap-2 border border-zinc-800 bg-zinc-950 p-3 md:grid-cols-[1fr_180px_auto]">
						<input type="hidden" name="gameId" value={game.id} />
						<input
							class="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
							name="title"
							placeholder="New category"
							required
						/>
						<select class="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" name="layout">
							<option value="checklist">Checklist</option>
							<option value="calendar">Calendar</option>
						</select>
						<button class="bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white">
							Add category
						</button>
					</form>

					<div class="grid gap-4">
						{#each game.categories as category}
							{@const summary = categorySummary(category)}
							<section class="border border-zinc-800 bg-zinc-950">
								<div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 p-3">
									<div>
										<div class="flex flex-wrap items-center gap-2">
											<h3 class="text-lg font-semibold">{category.title}</h3>
											<span class="border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
												{category.layout}
											</span>
										</div>
										<p class="mt-1 text-sm text-zinc-500">{summary.completed}/{summary.total} complete</p>
									</div>
									<form method="POST" action="?/deleteCategory">
										<input type="hidden" name="gameId" value={game.id} />
										<input type="hidden" name="categoryId" value={category.id} />
										<button class="border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
											Delete category
										</button>
									</form>
								</div>

								{#if category.layout === 'checklist'}
									<div class="grid gap-2 p-3">
										{#each category.items as item}
											<form method="POST" action="?/toggleChecklistItem" class="flex items-center gap-3 border border-zinc-800 bg-zinc-900 px-3 py-2">
												<input type="hidden" name="gameId" value={game.id} />
												<input type="hidden" name="categoryId" value={category.id} />
												<input type="hidden" name="itemId" value={item.id} />
												<input type="hidden" name="done" value={(!item.done).toString()} />
												<button
													class="grid size-6 place-items-center border border-zinc-600 text-sm hover:border-emerald-400"
													aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
												>
													{item.done ? '✓' : ''}
												</button>
												<span class:item-done={item.done} class="text-sm">{item.title}</span>
											</form>
										{/each}

										<form method="POST" action="?/addChecklistItem" class="grid gap-2 pt-2 md:grid-cols-[1fr_auto]">
											<input type="hidden" name="gameId" value={game.id} />
											<input type="hidden" name="categoryId" value={category.id} />
											<input
												class="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
												name="title"
												placeholder="New checklist item"
												required
											/>
											<button class="border border-emerald-500/60 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-950">
												Add item
											</button>
										</form>
									</div>
								{:else}
									<div class="grid gap-4 p-3">
										<div class="grid gap-3">
											{#each category.calendar.periods as period}
												{@const entries = entriesForPeriod(category, period.id)}
												<section>
													<h4 class="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">{period.title}</h4>
													<div class="grid grid-cols-5 gap-2 sm:grid-cols-7 lg:grid-cols-10 xl:grid-cols-15">
														{#each Array.from({ length: period.days }, (_, index) => index + 1) as day}
															{@const entry = entries.get(day)}
															<div class="min-h-24 border border-zinc-800 bg-zinc-900 p-2">
																<div class="flex items-start justify-between gap-2">
																	<p class="text-sm font-semibold text-white">{day}</p>
																	<p class="text-xs text-zinc-500">{dayCompletion(entry)}</p>
																</div>
																<div class="mt-2 grid gap-1">
																	{#each entry?.items ?? [] as item}
																		<form method="POST" action="?/toggleCalendarItem" class="flex gap-1 text-xs">
																			<input type="hidden" name="gameId" value={game.id} />
																			<input type="hidden" name="categoryId" value={category.id} />
																			<input type="hidden" name="entryId" value={entry?.id} />
																			<input type="hidden" name="itemId" value={item.id} />
																			<input type="hidden" name="done" value={(!item.done).toString()} />
																			<button
																				class="mt-0.5 grid size-4 shrink-0 place-items-center border border-zinc-600 leading-none hover:border-emerald-400"
																				aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
																			>
																				{item.done ? '✓' : ''}
																			</button>
																			<span class:item-done={item.done} class="min-w-0 text-zinc-300">{item.title}</span>
																		</form>
																	{/each}
																</div>
															</div>
														{/each}
													</div>
												</section>
											{/each}
										</div>

										<div class="grid gap-2 border border-zinc-800 bg-zinc-900 p-3 lg:grid-cols-2">
											<form method="POST" action="?/addCalendarItem" class="grid gap-2 md:grid-cols-[1fr_90px_2fr_auto]">
												<input type="hidden" name="gameId" value={game.id} />
												<input type="hidden" name="categoryId" value={category.id} />
												<select class="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" name="period">
													{#each category.calendar.periods as period}
														<option value={period.id}>{period.title}</option>
													{/each}
												</select>
												<input
													class="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
													name="day"
													type="number"
													min="1"
													placeholder="Day"
													required
												/>
												<input
													class="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
													name="title"
													placeholder="Calendar task"
													required
												/>
												<button class="border border-emerald-500/60 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-950">
													Add task
												</button>
											</form>

											<form method="POST" action="?/addCalendarPeriod" class="grid gap-2 md:grid-cols-[1fr_90px_auto]">
												<input type="hidden" name="gameId" value={game.id} />
												<input type="hidden" name="categoryId" value={category.id} />
												<input
													class="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
													name="title"
													placeholder="New period"
													required
												/>
												<input
													class="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
													name="days"
													type="number"
													min="1"
													max="99"
													value="30"
													required
												/>
												<button class="border border-zinc-700 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800">
													Add period
												</button>
											</form>
										</div>
									</div>
								{/if}
							</section>
						{/each}
					</div>
				</div>
			</article>
		{/each}
	</section>
</main>
