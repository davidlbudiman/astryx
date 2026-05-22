<script lang="ts">
	import type { PageData } from './$types';

	let { data, form } = $props();

	type Game = PageData['game'];
	type Category = PageData['game']['categories'][number];
	type ChecklistItem = Extract<Category, { layout: 'checklist' }>['items'][number];
	type CalendarCategory = Extract<Category, { layout: 'calendar' }>;
	type MutationResult = {
		game: Pick<Game, 'completed' | 'total' | 'status'>;
		categories: Category[];
		deletedCategoryId?: string;
	};
	type MutationResponse = { ok: true; result: MutationResult } | { ok: false; message: string };

	let gameState = $state.raw<Game | undefined>();
	let game = $derived(gameState ?? data.game);
	let activeCategoryId = $state<string | undefined>();
	let categoryIds = $derived(game.categories.map((category) => category.id));
	let selectedCategoryId = $derived(
		activeCategoryId && categoryIds.includes(activeCategoryId) ? activeCategoryId : categoryIds[0]
	);
	let activeCategory = $derived(game.categories.find((category) => category.id === selectedCategoryId));
	let message = $state('');
	let pendingKey = $state('');

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

	function selectCategory(categoryId: string) {
		activeCategoryId = categoryId;
	}

	function categoryMutationUrl(categoryId: string, path = '') {
		return `/${game.id}/categories/${categoryId}${path}`;
	}

	async function mutateCategory(
		categoryId: string,
		path: string,
		method: string,
		body: Record<string, unknown> | undefined,
		key: string
	) {
		pendingKey = key;
		message = '';
		activeCategoryId = categoryId;

		try {
			const response = await fetch(categoryMutationUrl(categoryId, path), {
				method,
				headers: body ? { 'Content-Type': 'application/json' } : undefined,
				body: body ? JSON.stringify(body) : undefined
			});
			const payload = (await response.json()) as MutationResponse;

			if (!payload.ok) {
				message = payload.message;
				return;
			}

			applyMutationResult(payload.result);
		} catch (caught) {
			message = caught instanceof Error ? caught.message : 'Unable to save changes.';
		} finally {
			pendingKey = '';
		}
	}

	function applyMutationResult(result: MutationResult) {
		const replacements = new Map(result.categories.map((category) => [category.id, category]));
		const deletedCategoryId = result.deletedCategoryId;
		const nextCategories = game.categories
			.filter((category) => category.id !== deletedCategoryId)
			.map((category) => replacements.get(category.id) ?? category);

		for (const category of result.categories) {
			if (!nextCategories.some((value) => value.id === category.id)) {
				nextCategories.push(category);
			}
		}

		nextCategories.sort((a, b) => a.title.localeCompare(b.title));
		gameState = { ...game, ...result.game, categories: nextCategories };

		if (!nextCategories.some((category) => category.id === activeCategoryId)) {
			activeCategoryId = nextCategories[0]?.id ?? '';
		}
	}

	function addDetailChecklistItemFromButton(button: HTMLButtonElement, categoryId: string, itemId: string) {
		const container = button.closest('[data-detail-add]');
		const input = container?.querySelector<HTMLInputElement>('input[name="title"]');
		const title = input?.value.trim() ?? '';

		if (!title) return;

		void mutateCategory(
			categoryId,
			'/detail-checklist-items',
			'POST',
			{ itemId, title },
			`add-detail-checklist-item:${categoryId}:${itemId}`
		).then(() => {
			if (!message && input) input.value = '';
		});
	}

	function addChecklistItemFromButton(button: HTMLButtonElement, categoryId: string) {
		const container = button.closest('[data-checklist-add]');
		const titleInput = container?.querySelector<HTMLInputElement>('input[name="title"]');
		const layoutSelect = container?.querySelector<HTMLSelectElement>('select[name="detailsLayout"]');
		const detailsTextarea = container?.querySelector<HTMLTextAreaElement>('textarea[name="details"]');
		const title = titleInput?.value.trim() ?? '';
		const rawDetails = detailsTextarea?.value.trim() ?? '';
		let details: ReturnType<typeof detailsFromText> | undefined;

		if (!title) return;

		if (rawDetails) {
			details = detailsFromText(rawDetails, layoutSelect?.value === 'bullets' ? 'bullets' : 'paragraphs');
		}

		void mutateCategory(
			categoryId,
			'/checklist-items',
			'POST',
			{ title, details },
			`add-checklist-item:${categoryId}`
		).then(() => {
			if (!message) {
				if (titleInput) titleInput.value = '';
				if (detailsTextarea) detailsTextarea.value = '';
			}
		});
	}

	function detailsFromText(raw: string, layout: 'bullets' | 'paragraphs') {
		if (layout === 'bullets') {
			const items = raw
				.split(/\r?\n/)
				.map((line) => line.replace(/^[-*]\s+/, '').trim())
				.filter(Boolean);

			return items.length > 0 ? { layout: 'bullets' as const, items } : undefined;
		}

		const paragraphs = raw
			.split(/\n\s*\n/)
			.map((paragraph) => paragraph.trim())
			.filter(Boolean);

		return paragraphs.length > 0 ? { layout: 'paragraphs' as const, paragraphs } : undefined;
	}

	function addCalendarItemFromButton(button: HTMLButtonElement, categoryId: string) {
		const container = button.closest('[data-calendar-item-add]');
		const periodSelect = container?.querySelector<HTMLSelectElement>('select[name="period"]');
		const dayInput = container?.querySelector<HTMLInputElement>('input[name="day"]');
		const titleInput = container?.querySelector<HTMLInputElement>('input[name="title"]');
		const title = titleInput?.value.trim() ?? '';

		if (!periodSelect?.value || !dayInput?.value || !title) return;

		void mutateCategory(
			categoryId,
			'/calendar-items',
			'POST',
			{ period: periodSelect.value, day: Number(dayInput.value), title },
			`add-calendar-item:${categoryId}`
		).then(() => {
			if (!message) {
				if (dayInput) dayInput.value = '';
				if (titleInput) titleInput.value = '';
			}
		});
	}

	function addCalendarPeriodFromButton(button: HTMLButtonElement, categoryId: string) {
		const container = button.closest('[data-calendar-period-add]');
		const titleInput = container?.querySelector<HTMLInputElement>('input[name="title"]');
		const daysInput = container?.querySelector<HTMLInputElement>('input[name="days"]');
		const title = titleInput?.value.trim() ?? '';

		if (!title || !daysInput?.value) return;

		void mutateCategory(
			categoryId,
			'/calendar-periods',
			'POST',
			{ title, days: Number(daysInput.value) },
			`add-calendar-period:${categoryId}`
		).then(() => {
			if (!message && titleInput) titleInput.value = '';
		});
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

			{#if form?.message || message}
				<p class="border border-red-500/50 bg-red-950 px-3 py-2 text-sm text-red-100">{form?.message ?? message}</p>
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

		{#if game.categories.length > 0}
			<div class="border border-zinc-800 bg-zinc-950">
				<div class="overflow-x-auto border-b border-zinc-800">
					<div class="flex min-w-max gap-1 p-2" role="tablist" aria-label="Categories">
						{#each game.categories as category}
							{@const summary = categorySummary(category)}
							{@const selected = category.id === activeCategory?.id}
							<button
								type="button"
								class={`min-w-36 border px-3 py-2 text-left text-sm ${
									selected
										? 'border-emerald-500/70 bg-emerald-950/50 text-emerald-100'
										: 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800'
								}`}
								role="tab"
								aria-selected={selected}
								aria-controls={`category-panel-${category.id}`}
								id={`category-tab-${category.id}`}
								onclick={() => selectCategory(category.id)}
							>
								<span class="block font-semibold text-zinc-100">{category.title}</span>
								<span class="mt-1 block text-xs text-zinc-500">
									{summary.completed}/{summary.total} complete
								</span>
							</button>
						{/each}
					</div>
				</div>

				{#if activeCategory}
					{@const category = activeCategory}
					{@const summary = categorySummary(category)}
					<div
						id={`category-panel-${category.id}`}
						role="tabpanel"
						aria-labelledby={`category-tab-${category.id}`}
					>
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
							<div>
								<button
									class="border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
									disabled={pendingKey === `delete-category:${category.id}`}
									type="button"
									onclick={() => {
										void mutateCategory(category.id, '', 'DELETE', undefined, `delete-category:${category.id}`);
									}}
								>
									Delete category
								</button>
							</div>
						</div>

					{#if category.layout === 'checklist'}
						<div class="grid gap-2 p-3">
							{#each category.items as item}
								<div class="border border-zinc-800 bg-zinc-900 px-3 py-2">
									<div class="flex items-center gap-3">
										<button
											class="grid size-6 shrink-0 place-items-center border border-zinc-600 text-sm hover:border-emerald-400"
											aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
											disabled={pendingKey === `toggle-checklist-item:${category.id}:${item.id}`}
											type="button"
											onclick={(e) => {
												e.preventDefault();
												void mutateCategory(
													category.id,
													'/checklist-items',
													'PATCH',
													{ itemId: item.id, done: !item.done },
													`toggle-checklist-item:${category.id}:${item.id}`
												);
											}}
										>
											{item.done ? '✓' : ''}
										</button>
										<span class:item-done={item.done} class="min-w-0 text-sm">{item.title}</span>
										{#if item.level}
											<span class="ml-auto shrink-0 border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
												Lv {item.level}
											</span>
										{/if}
									</div>

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
													<div class="flex items-center gap-2 text-sm">
														<button
															class="grid size-5 shrink-0 place-items-center border border-zinc-600 text-xs hover:border-emerald-400"
															aria-label={detailItem.done ? 'Mark incomplete' : 'Mark complete'}
															disabled={pendingKey === `toggle-detail-checklist-item:${category.id}:${item.id}:${detailItem.id}`}
															type="button"
															onclick={(event) => {
																event.preventDefault();
																void mutateCategory(
																	category.id,
																	'/detail-checklist-items',
																	'PATCH',
																	{ itemId: item.id, detailItemId: detailItem.id, done: !detailItem.done },
																	`toggle-detail-checklist-item:${category.id}:${item.id}:${detailItem.id}`
																);
															}}
														>
															{detailItem.done ? '✓' : ''}
														</button>
														<span class:item-done={detailItem.done} class="text-zinc-300">{detailItem.title}</span>
													</div>
												{/each}
												<div data-detail-add class="grid gap-2 sm:grid-cols-[1fr_auto]">
													<input
														class="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
														name="title"
														placeholder="Item from this step"
													/>
													<button
														class="border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
														disabled={pendingKey === `add-detail-checklist-item:${category.id}:${item.id}`}
														type="button"
														onclick={(event) => addDetailChecklistItemFromButton(event.currentTarget, category.id, item.id)}
													>
														Add
													</button>
												</div>
											</div>
										</details>
									{/if}
								</div>
							{/each}

							<div data-checklist-add class="grid gap-2 border-t border-zinc-800 pt-3 md:grid-cols-[1fr_180px_auto]">
								<input
									class="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
									name="title"
									placeholder="New checklist item"
								/>
								<select class="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" name="detailsLayout">
									<option value="paragraphs">Paragraphs</option>
									<option value="bullets">Bullet points</option>
								</select>
								<button
									class="border border-emerald-500/60 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-950"
									disabled={pendingKey === `add-checklist-item:${category.id}`}
									type="button"
									onclick={(event) => addChecklistItemFromButton(event.currentTarget, category.id)}
								>
									Add item
								</button>
								<textarea
									class="min-h-24 border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-400 md:col-span-3"
									name="details"
									placeholder="Optional details. Use one bullet per line or separate paragraphs with blank lines."
								></textarea>
							</div>
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
															<div class="flex gap-1 text-xs">
																<button
																	class="mt-0.5 grid size-4 shrink-0 place-items-center border border-zinc-600 leading-none hover:border-emerald-400"
																	aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
																	disabled={pendingKey === `toggle-calendar-item:${category.id}:${entry?.id}:${item.id}`}
																	type="button"
																	onclick={(event) => {
																		event.preventDefault();
																		void mutateCategory(
																			category.id,
																			'/calendar-items',
																			'PATCH',
																			{ entryId: entry?.id, itemId: item.id, done: !item.done },
																			`toggle-calendar-item:${category.id}:${entry?.id}:${item.id}`
																		);
																	}}
																>
																	{item.done ? '✓' : ''}
																</button>
																<span class:item-done={item.done} class="min-w-0 text-zinc-300">{item.title}</span>
															</div>
														{/each}
													</div>
												</div>
											{/each}
										</div>
									</section>
								{/each}
							</div>

							<div class="grid gap-2 border border-zinc-800 bg-zinc-900 p-3 lg:grid-cols-2">
								<div data-calendar-item-add class="grid gap-2 md:grid-cols-[1fr_90px_2fr_auto]">
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
									/>
									<input
										class="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
										name="title"
										placeholder="Calendar task"
									/>
									<button
										class="border border-emerald-500/60 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-950"
										disabled={pendingKey === `add-calendar-item:${category.id}`}
										type="button"
										onclick={(event) => addCalendarItemFromButton(event.currentTarget, category.id)}
									>
										Add task
									</button>
								</div>

								<div data-calendar-period-add class="grid gap-2 md:grid-cols-[1fr_90px_auto]">
									<input
										class="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
										name="title"
										placeholder="New period"
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
									<button
										class="border border-zinc-700 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
										disabled={pendingKey === `add-calendar-period:${category.id}`}
										type="button"
										onclick={(event) => addCalendarPeriodFromButton(event.currentTarget, category.id)}
									>
										Add period
									</button>
								</div>
							</div>
						</div>
					{/if}
					</div>
				{/if}
			</div>
		{:else}
			<p class="border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
				Add a category to start tracking this game.
			</p>
		{/if}
	</section>
</main>
