import type { RequestHandler } from './$types';
import { addChecklistItem, toggleChecklistItem, type ChecklistItemDetails } from '$lib/server/data';
import { booleanValue, jsonBody, mutationResponse, stringValue } from '$lib/server/mutation-endpoints';

function detailsValue(body: Record<string, unknown>): ChecklistItemDetails | undefined {
	const details = body.details;

	if (details === undefined) {
		return undefined;
	}

	if (!details || typeof details !== 'object' || Array.isArray(details)) {
		throw new Error('details must be an object.');
	}

	return details as ChecklistItemDetails;
}

export const POST: RequestHandler = async ({ request, params }) =>
	mutationResponse(async () => {
		const body = await jsonBody(request);
		return addChecklistItem({
			gameId: params.gameId,
			categoryId: params.categoryId,
			title: stringValue(body, 'title'),
			details: detailsValue(body)
		});
	});

export const PATCH: RequestHandler = async ({ request, params }) =>
	mutationResponse(async () => {
		const body = await jsonBody(request);
		return toggleChecklistItem({
			gameId: params.gameId,
			categoryId: params.categoryId,
			itemId: stringValue(body, 'itemId'),
			done: booleanValue(body, 'done')
		});
	});
