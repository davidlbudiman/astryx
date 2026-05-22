import type { RequestHandler } from './$types';
import { addCalendarPeriod } from '$lib/server/data';
import { jsonBody, mutationResponse, numberValue, stringValue } from '$lib/server/mutation-endpoints';

export const POST: RequestHandler = async ({ request, params }) =>
	mutationResponse(async () => {
		const body = await jsonBody(request);
		return addCalendarPeriod({
			gameId: params.gameId,
			categoryId: params.categoryId,
			title: stringValue(body, 'title'),
			days: numberValue(body, 'days')
		});
	});
