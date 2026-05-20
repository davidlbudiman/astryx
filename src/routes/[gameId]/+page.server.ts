import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addCalendarItem,
	addCalendarPeriod,
	addCategory,
	addDetailChecklistItem,
	addChecklistItem,
	deleteCategory,
	deleteGame,
	readLibrary,
	toggleCalendarItem,
	toggleDetailChecklistItem,
	toggleChecklistItem,
	type ChecklistItemDetails
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

function detailsValue(form: FormData): ChecklistItemDetails | undefined {
	const raw = text(form, 'details');

	if (!raw) {
		return undefined;
	}

	if (text(form, 'detailsLayout') === 'bullets') {
		const items = raw
			.split(/\r?\n/)
			.map((line) => line.replace(/^[-*]\s+/, '').trim())
			.filter(Boolean);

		return items.length > 0 ? { layout: 'bullets', items } : undefined;
	}

	const paragraphs = raw
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);

	return paragraphs.length > 0 ? { layout: 'paragraphs', paragraphs } : undefined;
}

async function run(action: () => Promise<void>) {
	try {
		await action();
		return { ok: true };
	} catch (caught) {
		return fail(400, {
			message: caught instanceof Error ? caught.message : 'Unable to save changes.'
		});
	}
}

export const load: PageServerLoad = async ({ params }) => {
	const library = await readLibrary();
	const game = library.find((item) => item.id === params.gameId);

	if (!game) {
		error(404, 'Game not found.');
	}

	return { game };
};

export const actions: Actions = {
	addCategory: async ({ request, params }) => {
		const form = await request.formData();
		return run(() =>
			addCategory({
				gameId: params.gameId,
				title: text(form, 'title'),
				layout: text(form, 'layout') as 'checklist' | 'calendar'
			})
		);
	},
	addChecklistItem: async ({ request, params }) => {
		const form = await request.formData();
		return run(() =>
			addChecklistItem({
				gameId: params.gameId,
				categoryId: text(form, 'categoryId'),
				title: text(form, 'title'),
				details: detailsValue(form)
			})
		);
	},
	addDetailChecklistItem: async ({ request, params }) => {
		const form = await request.formData();
		return run(() =>
			addDetailChecklistItem({
				gameId: params.gameId,
				categoryId: text(form, 'categoryId'),
				itemId: text(form, 'itemId'),
				title: text(form, 'title')
			})
		);
	},
	addCalendarPeriod: async ({ request, params }) => {
		const form = await request.formData();
		return run(() =>
			addCalendarPeriod({
				gameId: params.gameId,
				categoryId: text(form, 'categoryId'),
				title: text(form, 'title'),
				days: numberValue(form, 'days')
			})
		);
	},
	addCalendarItem: async ({ request, params }) => {
		const form = await request.formData();
		return run(() =>
			addCalendarItem({
				gameId: params.gameId,
				categoryId: text(form, 'categoryId'),
				period: text(form, 'period'),
				day: numberValue(form, 'day'),
				title: text(form, 'title')
			})
		);
	},
	toggleChecklistItem: async ({ request, params }) => {
		const form = await request.formData();
		return run(() =>
			toggleChecklistItem({
				gameId: params.gameId,
				categoryId: text(form, 'categoryId'),
				itemId: text(form, 'itemId'),
				done: text(form, 'done') === 'true'
			})
		);
	},
	toggleDetailChecklistItem: async ({ request, params }) => {
		const form = await request.formData();
		return run(() =>
			toggleDetailChecklistItem({
				gameId: params.gameId,
				categoryId: text(form, 'categoryId'),
				itemId: text(form, 'itemId'),
				detailItemId: text(form, 'detailItemId'),
				done: text(form, 'done') === 'true'
			})
		);
	},
	toggleCalendarItem: async ({ request, params }) => {
		const form = await request.formData();
		return run(() =>
			toggleCalendarItem({
				gameId: params.gameId,
				categoryId: text(form, 'categoryId'),
				entryId: text(form, 'entryId'),
				itemId: text(form, 'itemId'),
				done: text(form, 'done') === 'true'
			})
		);
	},
	deleteGame: async ({ params }) => {
		await deleteGame(params.gameId);
		redirect(303, '/');
	},
	deleteCategory: async ({ request, params }) => {
		const form = await request.formData();
		return run(() => deleteCategory(params.gameId, text(form, 'categoryId')));
	}
};
