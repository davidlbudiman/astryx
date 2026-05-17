import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addCalendarItem,
	addCalendarPeriod,
	addCategory,
	addChecklistItem,
	addGame,
	deleteCategory,
	deleteGame,
	readLibrary,
	updateGameStatus,
	toggleCalendarItem,
	toggleChecklistItem,
	type GameStatus
} from '$lib/server/data';

function text(form: FormData, key: string) {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

function numberValue(form: FormData, key: string) {
	const value = Number(text(form, key));
	if (!Number.isFinite(value)) {
		throw new Error(`${key} must be a number.`);
	}
	return value;
}

async function run(action: () => Promise<void>) {
	try {
		await action();
		return { ok: true };
	} catch (error) {
		return fail(400, {
			message: error instanceof Error ? error.message : 'Unable to save changes.'
		});
	}
}

export const load: PageServerLoad = async () => {
	return {
		library: await readLibrary()
	};
};

export const actions: Actions = {
	addGame: async ({ request }) => {
		const form = await request.formData();
		return run(() =>
			addGame({
				title: text(form, 'title'),
				platform: text(form, 'platform'),
				status: text(form, 'status') as GameStatus
			})
		);
	},
	updateGameStatus: async ({ request }) => {
		const form = await request.formData();
		return run(() => updateGameStatus(text(form, 'gameId'), text(form, 'status') as GameStatus));
	},
	addCategory: async ({ request }) => {
		const form = await request.formData();
		return run(() =>
			addCategory({
				gameId: text(form, 'gameId'),
				title: text(form, 'title'),
				layout: text(form, 'layout') as 'checklist' | 'calendar'
			})
		);
	},
	addChecklistItem: async ({ request }) => {
		const form = await request.formData();
		return run(() =>
			addChecklistItem({
				gameId: text(form, 'gameId'),
				categoryId: text(form, 'categoryId'),
				title: text(form, 'title')
			})
		);
	},
	addCalendarPeriod: async ({ request }) => {
		const form = await request.formData();
		return run(() =>
			addCalendarPeriod({
				gameId: text(form, 'gameId'),
				categoryId: text(form, 'categoryId'),
				title: text(form, 'title'),
				days: numberValue(form, 'days')
			})
		);
	},
	addCalendarItem: async ({ request }) => {
		const form = await request.formData();
		return run(() =>
			addCalendarItem({
				gameId: text(form, 'gameId'),
				categoryId: text(form, 'categoryId'),
				period: text(form, 'period'),
				day: numberValue(form, 'day'),
				title: text(form, 'title')
			})
		);
	},
	toggleChecklistItem: async ({ request }) => {
		const form = await request.formData();
		return run(() =>
			toggleChecklistItem({
				gameId: text(form, 'gameId'),
				categoryId: text(form, 'categoryId'),
				itemId: text(form, 'itemId'),
				done: text(form, 'done') === 'true'
			})
		);
	},
	toggleCalendarItem: async ({ request }) => {
		const form = await request.formData();
		return run(() =>
			toggleCalendarItem({
				gameId: text(form, 'gameId'),
				categoryId: text(form, 'categoryId'),
				entryId: text(form, 'entryId'),
				itemId: text(form, 'itemId'),
				done: text(form, 'done') === 'true'
			})
		);
	},
	deleteGame: async ({ request }) => {
		const form = await request.formData();
		return run(() => deleteGame(text(form, 'gameId')));
	},
	deleteCategory: async ({ request }) => {
		const form = await request.formData();
		return run(() => deleteCategory(text(form, 'gameId'), text(form, 'categoryId')));
	}
};
