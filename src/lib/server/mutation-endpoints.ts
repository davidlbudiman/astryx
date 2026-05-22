import { json } from '@sveltejs/kit';

export async function mutationResponse<T>(action: () => Promise<T>) {
	try {
		return json({ ok: true, result: await action() });
	} catch (caught) {
		return json(
			{
				ok: false,
				message: caught instanceof Error ? caught.message : 'Unable to save changes.'
			},
			{ status: 400 }
		);
	}
}

export async function jsonBody(request: Request) {
	const body: unknown = await request.json();

	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new Error('Request body must be a JSON object.');
	}

	return body as Record<string, unknown>;
}

export function stringValue(body: Record<string, unknown>, key: string) {
	const value = body[key];

	if (typeof value !== 'string') {
		throw new Error(`${key} must be a string.`);
	}

	return value.trim();
}

export function booleanValue(body: Record<string, unknown>, key: string) {
	const value = body[key];

	if (typeof value !== 'boolean') {
		throw new Error(`${key} must be a boolean.`);
	}

	return value;
}

export function numberValue(body: Record<string, unknown>, key: string) {
	const value = body[key];

	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`${key} must be a number.`);
	}

	return value;
}
