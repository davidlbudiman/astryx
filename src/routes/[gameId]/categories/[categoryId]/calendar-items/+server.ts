import type { RequestHandler } from './$types';
import { addCalendarItem, toggleCalendarItem } from '$lib/server/data';
import {
	booleanValue,
	jsonBody,
	mutationResponse,
	numberValue,
	stringValue
} from '$lib/server/mutation-endpoints';

export const POST: RequestHandler = async ({ request, params }) =>
	mutationResponse(async () => {
		const body = await jsonBody(request);
		return addCalendarItem({
			gameId: params.gameId,
			categoryId: params.categoryId,
			period: stringValue(body, 'period'),
			day: numberValue(body, 'day'),
			title: stringValue(body, 'title')
		});
	});

export const PATCH: RequestHandler = async ({ request, params }) =>
	mutationResponse(async () => {
		const body = await jsonBody(request);
		return toggleCalendarItem({
			gameId: params.gameId,
			categoryId: params.categoryId,
			entryId: stringValue(body, 'entryId'),
			itemId: stringValue(body, 'itemId'),
			done: booleanValue(body, 'done')
		});
	});
