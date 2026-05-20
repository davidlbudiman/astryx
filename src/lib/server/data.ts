import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const dataRoot = path.resolve('data');
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens.');

const gameStatusSchema = z.enum(['not-started', 'playing', 'completed']);

const gameSchema = z.object({
	id: slugSchema,
	title: z.string().min(1),
	platform: z.string().min(1),
	folder: slugSchema
});

const gamesFileSchema = z.object({
	games: z.array(gameSchema)
});

const nestedChecklistItemSchema = z.object({
	id: slugSchema,
	title: z.string().min(1),
	done: z.boolean()
});

const checklistItemDetailsSchema = z.discriminatedUnion('layout', [
	z.object({
		layout: z.literal('bullets'),
		items: z.array(z.string().min(1)),
		checklist: z.array(nestedChecklistItemSchema).optional()
	}),
	z.object({
		layout: z.literal('paragraphs'),
		paragraphs: z.array(z.string().min(1)),
		checklist: z.array(nestedChecklistItemSchema).optional()
	})
]);

const checklistItemSchema = z.object({
	id: slugSchema,
	title: z.string().min(1),
	done: z.boolean(),
	details: checklistItemDetailsSchema.optional()
});

const checklistCategorySchema = z.object({
	id: slugSchema,
	title: z.string().min(1),
	layout: z.literal('checklist'),
	items: z.array(checklistItemSchema)
});

const calendarPeriodSchema = z.object({
	id: slugSchema,
	title: z.string().min(1),
	days: z.number().int().min(1).max(99)
});

const calendarEntrySchema = z.object({
	id: slugSchema,
	period: slugSchema,
	day: z.number().int().min(1).max(99),
	items: z.array(checklistItemSchema)
});

const calendarCategorySchema = z.object({
	id: slugSchema,
	title: z.string().min(1),
	layout: z.literal('calendar'),
	calendar: z.object({
		periods: z.array(calendarPeriodSchema).min(1)
	}),
	entries: z.array(calendarEntrySchema)
});

const categorySchema = z.discriminatedUnion('layout', [checklistCategorySchema, calendarCategorySchema]);

export type Game = z.infer<typeof gameSchema>;
export type GamesFile = z.infer<typeof gamesFileSchema>;
export type NestedChecklistItem = z.infer<typeof nestedChecklistItemSchema>;
export type ChecklistItemDetails = z.infer<typeof checklistItemDetailsSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type ChecklistCategory = z.infer<typeof checklistCategorySchema>;
export type CalendarCategory = z.infer<typeof calendarCategorySchema>;
export type Category = z.infer<typeof categorySchema>;
export type GameStatus = z.infer<typeof gameStatusSchema>;

export type GameWithCategories = Game & {
	categories: Category[];
	completed: number;
	total: number;
	status: GameStatus;
};

export function toSlug(value: string) {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return slug || 'item';
}

export function validateSlug(value: string) {
	return slugSchema.parse(value);
}

export function categoryFileName(categoryId: string) {
	return `${validateSlug(categoryId)}.json`;
}

function dataPath(...segments: string[]) {
	const resolved = path.resolve(dataRoot, ...segments);

	if (!resolved.startsWith(`${dataRoot}${path.sep}`) && resolved !== dataRoot) {
		throw new Error('Invalid data path.');
	}

	return resolved;
}

async function readJson<T>(filePath: string, schema: z.ZodType<T>) {
	const raw = await readFile(filePath, 'utf8');
	return schema.parse(JSON.parse(raw));
}

async function writeJson(filePath: string, data: unknown) {
	await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function readGamesFile(): Promise<GamesFile> {
	return readJson(dataPath('games.json'), gamesFileSchema);
}

export async function writeGamesFile(gamesFile: GamesFile) {
	await mkdir(dataRoot, { recursive: true });
	await writeJson(dataPath('games.json'), gamesFileSchema.parse(gamesFile));
}

export async function readCategory(gameFolder: string, fileName: string): Promise<Category> {
	validateSlug(gameFolder);

	if (!fileName.endsWith('.json')) {
		throw new Error('Category file must be JSON.');
	}

	validateSlug(fileName.slice(0, -5));
	return readJson(dataPath(gameFolder, fileName), categorySchema);
}

export async function writeCategory(gameFolder: string, category: Category) {
	validateSlug(gameFolder);
	const parsed = categorySchema.parse(category);
	const folderPath = dataPath(gameFolder);
	await mkdir(folderPath, { recursive: true });
	await writeJson(dataPath(gameFolder, categoryFileName(parsed.id)), parsed);
}

export async function readCategories(gameFolder: string): Promise<Category[]> {
	validateSlug(gameFolder);
	const folderPath = dataPath(gameFolder);
	const files = (await readdir(folderPath)).filter((file) => file.endsWith('.json')).sort();
	const categories = await Promise.all(files.map((file) => readCategory(gameFolder, file)));

	return categories.sort((a, b) => a.title.localeCompare(b.title));
}

export async function readLibrary(): Promise<GameWithCategories[]> {
	const { games } = await readGamesFile();
	const library = await Promise.all(
		games.map(async (game) => {
			const categories = await readCategories(game.folder);
			const { completed, total } = summarizeCategories(categories);

			return { ...game, categories, completed, total, status: deriveGameStatus(completed, total) };
		})
	);

	return library;
}

export function summarizeCategories(categories: Category[]) {
	return categories.reduce(
		(summary, category) => {
			const items = checklistItems(
				category.layout === 'checklist'
					? category.items
					: category.entries.flatMap((entry) => entry.items)
			);

			summary.completed += items.filter((item) => item.done).length;
			summary.total += items.length;
			return summary;
		},
		{ completed: 0, total: 0 }
	);
}

export function summarizeCategory(category: Category) {
	return summarizeCategories([category]);
}

function checklistItems(items: ChecklistItem[]) {
	return items.flatMap((item) => [item, ...(item.details?.checklist ?? [])]);
}

export function deriveGameStatus(completed: number, total: number): GameStatus {
	if (total > 0 && completed === total) {
		return 'completed';
	}

	return completed > 0 ? 'playing' : 'not-started';
}

export async function addGame(input: { title: string; platform: string }) {
	const gamesFile = await readGamesFile();
	const id = uniqueSlug(toSlug(input.title), gamesFile.games.map((game) => game.id));
	const game: Game = {
		id,
		title: input.title.trim(),
		platform: input.platform.trim(),
		folder: id
	};

	gamesFile.games.push(game);
	await writeGamesFile(gamesFile);
	await mkdir(dataPath(id), { recursive: true });
	await writeCategory(id, {
		id: 'story',
		title: 'Story',
		layout: 'checklist',
		items: []
	});
}

export async function addCategory(input: {
	gameId: string;
	title: string;
	layout: 'checklist' | 'calendar';
}) {
	const gamesFile = await readGamesFile();
	const game = gamesFile.games.find((item) => item.id === validateSlug(input.gameId));

	if (!game) {
		throw new Error('Game not found.');
	}

	const existing = await readCategories(game.folder);
	const id = uniqueSlug(
		toSlug(input.title),
		existing.map((category) => category.id)
	);

	if (input.layout === 'calendar') {
		await writeCategory(game.folder, {
			id,
			title: input.title.trim(),
			layout: 'calendar',
			calendar: {
				periods: [
					{ id: 'spring', title: 'Spring', days: 30 },
					{ id: 'summer', title: 'Summer', days: 30 },
					{ id: 'autumn', title: 'Autumn', days: 30 },
					{ id: 'winter', title: 'Winter', days: 30 }
				]
			},
			entries: []
		});
		return;
	}

	await writeCategory(game.folder, {
		id,
		title: input.title.trim(),
		layout: 'checklist',
		items: []
	});
}

export async function addChecklistItem(input: {
	gameId: string;
	categoryId: string;
	title: string;
	details?: ChecklistItemDetails;
}) {
	const { game, category } = await findCategory(input.gameId, input.categoryId);

	if (category.layout !== 'checklist') {
		throw new Error('Category is not a checklist.');
	}

	category.items.push({
		id: uniqueSlug(
			toSlug(input.title),
			category.items.map((item) => item.id)
		),
		title: input.title.trim(),
		done: false,
		...(input.details ? { details: input.details } : {})
	});

	await writeCategory(game.folder, category);
}

export async function addCalendarPeriod(input: {
	gameId: string;
	categoryId: string;
	title: string;
	days: number;
}) {
	const { game, category } = await findCategory(input.gameId, input.categoryId);

	if (category.layout !== 'calendar') {
		throw new Error('Category is not a calendar.');
	}

	category.calendar.periods.push({
		id: uniqueSlug(
			toSlug(input.title),
			category.calendar.periods.map((period) => period.id)
		),
		title: input.title.trim(),
		days: input.days
	});

	await writeCategory(game.folder, category);
}

export async function addCalendarItem(input: {
	gameId: string;
	categoryId: string;
	period: string;
	day: number;
	title: string;
}) {
	const { game, category } = await findCategory(input.gameId, input.categoryId);

	if (category.layout !== 'calendar') {
		throw new Error('Category is not a calendar.');
	}

	const period = category.calendar.periods.find((item) => item.id === validateSlug(input.period));

	if (!period || input.day < 1 || input.day > period.days) {
		throw new Error('Invalid calendar day.');
	}

	const entryId = `${period.id}-${String(input.day).padStart(2, '0')}`;
	let entry = category.entries.find((item) => item.id === entryId);

	if (!entry) {
		entry = { id: entryId, period: period.id, day: input.day, items: [] };
		category.entries.push(entry);
	}

	entry.items.push({
		id: uniqueSlug(
			toSlug(input.title),
			entry.items.map((item) => item.id)
		),
		title: input.title.trim(),
		done: false
	});

	category.entries.sort((a, b) => a.period.localeCompare(b.period) || a.day - b.day);
	await writeCategory(game.folder, category);
}

export async function toggleChecklistItem(input: {
	gameId: string;
	categoryId: string;
	itemId: string;
	done: boolean;
}) {
	const { game, category } = await findCategory(input.gameId, input.categoryId);

	if (category.layout !== 'checklist') {
		throw new Error('Category is not a checklist.');
	}

	const item = category.items.find((value) => value.id === validateSlug(input.itemId));

	if (!item) {
		throw new Error('Item not found.');
	}

	item.done = input.done;
	await writeCategory(game.folder, category);
}

export async function addDetailChecklistItem(input: {
	gameId: string;
	categoryId: string;
	itemId: string;
	title: string;
}) {
	const { game, category, item } = await findChecklistItem(input.gameId, input.categoryId, input.itemId);
	const checklist = item.details?.checklist ?? [];

	if (!item.details) {
		item.details = { layout: 'bullets', items: [], checklist };
	} else {
		item.details.checklist = checklist;
	}

	checklist.push({
		id: uniqueSlug(
			toSlug(input.title),
			checklist.map((value) => value.id)
		),
		title: input.title.trim(),
		done: false
	});

	await writeCategory(game.folder, category);
}

export async function toggleDetailChecklistItem(input: {
	gameId: string;
	categoryId: string;
	itemId: string;
	detailItemId: string;
	done: boolean;
}) {
	const { game, category, item } = await findChecklistItem(input.gameId, input.categoryId, input.itemId);
	const detailItem = item.details?.checklist?.find((value) => value.id === validateSlug(input.detailItemId));

	if (!detailItem) {
		throw new Error('Detail checklist item not found.');
	}

	detailItem.done = input.done;
	await writeCategory(game.folder, category);
}

export async function toggleCalendarItem(input: {
	gameId: string;
	categoryId: string;
	entryId: string;
	itemId: string;
	done: boolean;
}) {
	const { game, category } = await findCategory(input.gameId, input.categoryId);

	if (category.layout !== 'calendar') {
		throw new Error('Category is not a calendar.');
	}

	const entry = category.entries.find((value) => value.id === validateSlug(input.entryId));
	const item = entry?.items.find((value) => value.id === validateSlug(input.itemId));

	if (!item) {
		throw new Error('Item not found.');
	}

	item.done = input.done;
	await writeCategory(game.folder, category);
}

export async function deleteGame(gameId: string) {
	const gamesFile = await readGamesFile();
	const game = gamesFile.games.find((item) => item.id === validateSlug(gameId));

	if (!game) {
		throw new Error('Game not found.');
	}

	gamesFile.games = gamesFile.games.filter((item) => item.id !== game.id);
	await writeGamesFile(gamesFile);
	await rm(dataPath(game.folder), { recursive: true, force: true });
}

export async function deleteCategory(gameId: string, categoryId: string) {
	const gamesFile = await readGamesFile();
	const game = gamesFile.games.find((item) => item.id === validateSlug(gameId));

	if (!game) {
		throw new Error('Game not found.');
	}

	await rm(dataPath(game.folder, categoryFileName(categoryId)), { force: true });
}

export async function renameGameFolder(oldFolder: string, newFolder: string) {
	validateSlug(oldFolder);
	validateSlug(newFolder);
	await rename(dataPath(oldFolder), dataPath(newFolder));
}

async function findCategory(gameId: string, categoryId: string) {
	const gamesFile = await readGamesFile();
	const game = gamesFile.games.find((item) => item.id === validateSlug(gameId));

	if (!game) {
		throw new Error('Game not found.');
	}

	const category = await readCategory(game.folder, categoryFileName(categoryId));
	return { game, category };
}

async function findChecklistItem(gameId: string, categoryId: string, itemId: string) {
	const { game, category } = await findCategory(gameId, categoryId);

	if (category.layout !== 'checklist') {
		throw new Error('Category is not a checklist.');
	}

	const item = category.items.find((value) => value.id === validateSlug(itemId));

	if (!item) {
		throw new Error('Item not found.');
	}

	return { game, category, item };
}

function uniqueSlug(base: string, existing: string[]) {
	const taken = new Set(existing);
	let candidate = validateSlug(base);
	let index = 2;

	while (taken.has(candidate)) {
		candidate = `${base}-${index}`;
		index += 1;
	}

	return candidate;
}
