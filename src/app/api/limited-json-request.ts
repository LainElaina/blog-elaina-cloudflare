export class JsonRequestBodyTooLargeError extends Error {
	constructor() {
		super('JSON request body is too large')
		this.name = 'JsonRequestBodyTooLargeError'
	}
}

export function isJsonRequestBodyTooLargeError(error: unknown) {
	return error instanceof JsonRequestBodyTooLargeError
}

export async function readLimitedJsonRequest(request: Request, maxBytes: number): Promise<unknown> {
	if (!('headers' in request) || !('body' in request)) {
		return request.json()
	}

	const contentLength = Number(request.headers.get('content-length'))
	if (Number.isFinite(contentLength) && contentLength > maxBytes) {
		throw new JsonRequestBodyTooLargeError()
	}

	if (!request.body) {
		return request.json()
	}

	const reader = request.body.getReader()
	const chunks: Uint8Array[] = []
	let totalBytes = 0

	while (true) {
		const { done, value } = await reader.read()
		if (done) {
			break
		}
		if (!value) {
			continue
		}
		totalBytes += value.byteLength
		if (totalBytes > maxBytes) {
			await reader.cancel().catch(() => undefined)
			throw new JsonRequestBodyTooLargeError()
		}
		chunks.push(value)
	}

	const body = new Uint8Array(totalBytes)
	let offset = 0
	for (const chunk of chunks) {
		body.set(chunk, offset)
		offset += chunk.byteLength
	}

	return JSON.parse(new TextDecoder().decode(body))
}
