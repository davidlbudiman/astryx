import type { RequestHandler } from './$types';
import { deleteCategory } from '$lib/server/data';
import { mutationResponse } from '$lib/server/mutation-endpoints';

export const DELETE: RequestHandler = async ({ params }) =>
	mutationResponse(() => deleteCategory(params.gameId, params.categoryId));
