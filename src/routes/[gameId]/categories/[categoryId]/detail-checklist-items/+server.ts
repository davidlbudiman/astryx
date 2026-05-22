import type { RequestHandler } from './$types';
import { addDetailChecklistItem, toggleDetailChecklistItem } from '$lib/server/data';
import { booleanValue, jsonBody, mutationResponse, stringValue } from '$lib/server/mutation-endpoints';

export const POST: RequestHandler = async ({ request, params }) =>
	mutationResponse(async () => {
		const body = await jsonBody(request);
		return addDetailChecklistItem({
			gameId: params.gameId,
			categoryId: params.categoryId,
			itemId: stringValue(body, 'itemId'),
			title: stringValue(body, 'title')
		});
	});

export const PATCH: RequestHandler = async ({ request, params }) =>
	mutationResponse(async () => {
		const body = await jsonBody(request);
		return toggleDetailChecklistItem({
			gameId: params.gameId,
			categoryId: params.categoryId,
			itemId: stringValue(body, 'itemId'),
			detailItemId: stringValue(body, 'detailItemId'),
			done: booleanValue(body, 'done')
		});
	});
