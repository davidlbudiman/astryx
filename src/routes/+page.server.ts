import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addGame,
	readLibrary
} from '$lib/server/data';

function text(form: FormData, key: string) {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim() : '';
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
				platform: text(form, 'platform')
			})
		);
	}
};
