import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addCategory,
	deleteGame,
	readGame
} from '$lib/server/data';

function text(form: FormData, key: string) {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim() : '';
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
	try {
		return { game: await readGame(params.gameId) };
	} catch (caught) {
		error(404, 'Game not found.');
	}
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
	deleteGame: async ({ params }) => {
		await deleteGame(params.gameId);
		redirect(303, '/');
	}
};
