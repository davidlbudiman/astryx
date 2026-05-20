<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data, form } = $props();

	type Category = PageData['game']['categories'][number];
	type ChecklistItem = Extract<Category, { layout: 'checklist' }>['items'][number];
	type CalendarCategory = Extract<Category, { layout: 'calendar' }>;

	let game = $derived(data.game);

	function percent(done: number, total: number) {
		return total === 0 ? 0 : Math.round((done / total) * 100);
	}

	function statusLabel(status: string) {
		return status
			.split('-')
			.map((part) => part[0].toUpperCase() + part.slice(1))
			.join(' ');
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

	function hasDetails(item: ChecklistItem) {
		if (!item.details) return false;

		const hasText =
			item.details.layout === 'bullets'
				? item.details.items.length > 0
				: item.details.paragraphs.length > 0;

		return hasText || (item.details.checklist?.length ?? 0) > 0;
	}
</script>

<svelte:head>
	<title>{game.title} | Astryx</title>
	<meta name="description" content={`Track ${game.title} completion in Astryx.`} />
</svelte:head>

<main class="min-h-screen bg-zinc-950 text-zinc-100">
	<section class="border-b border-zinc-800 bg-zinc-950/95">
		<div class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
			<a class="w-fit border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-emerald-500/70 hover:bg-zinc-900" href="/">
				Previous page
			</a>

			<div class="grid gap-4 lg:grid-cols-[1fr_auto]">
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-3xl font-semibold text-white">{game.title}</h1>
						<span class="border border-zinc-700 px-2 py-1 text-xs text-zinc-300">{game.platform}</span>
						<span class="border border-zinc-700 px-2 py-1 text-xs text-zinc-300">{statusLabel(game.status)}</span>
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
					<form method="POST" action="?/deleteGame">
						<button
							class="border border-red-500/50 px-3 py-2 text-sm text-red-100 hover:bg-red-950"
							formaction="?/deleteGame"
						>
							Delete
						</button>
					</form>
				</div>
			</div>

			{#if form?.message}
				<p class="border border-red-500/50 bg-red-950 px-3 py-2 text-sm text-red-100">{form.message}</p>
			{/if}
		</div>
	</section>

	<section class="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
		<form method="POST" action="?/addCategory" class="grid gap-2 border border-zinc-800 bg-zinc-950 p-3 md:grid-cols-[1fr_180px_auto]">
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
								<h2 class="text-lg font-semibold">{category.title}</h2>
								<span class="border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
									{category.layout}
								</span>
							</div>
							<p class="mt-1 text-sm text-zinc-500">{summary.completed}/{summary.total} complete</p>
						</div>
						<form method="POST" action="?/deleteCategory">
							<input type="hidden" name="categoryId" value={category.id} />
							<button class="border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
								Delete category
							</button>
						</form>
					</div>

					{#if category.layout === 'checklist'}
						<div class="grid gap-2 p-3">
							{#each category.items as item}
								<div class="border border-zinc-800 bg-zinc-900 px-3 py-2">
									<form method="POST" action="?/toggleChecklistItem" class="flex items-center gap-3" use:enhance>
										<input type="hidden" name="categoryId" value={category.id} />
										<input type="hidden" name="itemId" value={item.id} />
										<input type="hidden" name="done" value={(!item.done).toString()} />
										<button
											class="grid size-6 shrink-0 place-items-center border border-zinc-600 text-sm hover:border-emerald-400"
											aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
										>
											{item.done ? '✓' : ''}
										</button>
										<span class:item-done={item.done} class="text-sm">{item.title}</span>
									</form>

									{#if hasDetails(item)}
										<details class="mt-2 border-t border-zinc-800 pt-2 text-sm">
											<summary class="cursor-pointer text-zinc-400 hover:text-zinc-200">Details</summary>
											{#if item.details?.layout === 'bullets'}
												<ul class="mt-2 list-disc space-y-1 pl-5 text-zinc-300">
													{#each item.details.items as detail}
														<li>{detail}</li>
													{/each}
												</ul>
											{:else if item.details?.layout === 'paragraphs'}
												<div class="mt-2 grid gap-2 text-zinc-300">
													{#each item.details.paragraphs as paragraph}
														<p>{paragraph}</p>
													{/each}
												</div>
											{/if}
											<div class="mt-3 grid gap-2 border-t border-zinc-800 pt-3">
												<p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Checklist</p>
												{#each item.details?.checklist ?? [] as detailItem}
													<form method="POST" action="?/toggleDetailChecklistItem" class="flex items-center gap-2 text-sm" use:enhance>
														<input type="hidden" name="categoryId" value={category.id} />
														<input type="hidden" name="itemId" value={item.id} />
														<input type="hidden" name="detailItemId" value={detailItem.id} />
														<input type="hidden" name="done" value={(!detailItem.done).toString()} />
														<button
															class="grid size-5 shrink-0 place-items-center border border-zinc-600 text-xs hover:border-emerald-400"
															aria-label={detailItem.done ? 'Mark incomplete' : 'Mark complete'}
														>
															{detailItem.done ? '✓' : ''}
														</button>
														<span class:item-done={detailItem.done} class="text-zinc-300">{detailItem.title}</span>
													</form>
												{/each}
												<form method="POST" action="?/addDetailChecklistItem" class="grid gap-2 sm:grid-cols-[1fr_auto]">
													<input type="hidden" name="categoryId" value={category.id} />
													<input type="hidden" name="itemId" value={item.id} />
													<input
														class="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
														name="title"
														placeholder="Item from this step"
														required
													/>
													<button class="border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800">
														Add
													</button>
												</form>
											</div>
										</details>
									{/if}
								</div>
							{/each}

							<form method="POST" action="?/addChecklistItem" class="grid gap-2 border-t border-zinc-800 pt-3 md:grid-cols-[1fr_180px_auto]">
								<input type="hidden" name="categoryId" value={category.id} />
								<input
									class="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
									name="title"
									placeholder="New checklist item"
									required
								/>
								<select class="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" name="detailsLayout">
									<option value="paragraphs">Paragraphs</option>
									<option value="bullets">Bullet points</option>
								</select>
								<button class="border border-emerald-500/60 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-950">
									Add item
								</button>
								<textarea
									class="min-h-24 border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-400 md:col-span-3"
									name="details"
									placeholder="Optional details. Use one bullet per line or separate paragraphs with blank lines."
								></textarea>
							</form>
						</div>
					{:else}
						<div class="grid gap-4 p-3">
							<div class="grid gap-3">
								{#each category.calendar.periods as period}
									{@const entries = entriesForPeriod(category, period.id)}
									<section>
										<h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">{period.title}</h3>
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
															<form method="POST" action="?/toggleCalendarItem" class="flex gap-1 text-xs" use:enhance>
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
	</section>
</main>
