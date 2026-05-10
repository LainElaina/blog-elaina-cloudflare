export class JsonRequestBodyTooLargeError extends Error {
	constructor() {
		super('JSON request body is too large')
		this.name = 'JsonRequestBodyTooLargeError'
	}
}

export function isJsonRequestBodyTooLargeError(error: unknown) {
	return error instanceof JsonRequestBodyTooLargeError
}

export function getLimitedJsonRequestErrorStatus(error: unknown) {
	return isJsonRequestBodyTooLargeError(error) ? 413 : 400
}

function getJsonRequestContentLength(request: Request) {
	const value = request.headers?.get('content-length')
	if (!value) return null
	const length = Number(value)
	return Number.isFinite(length) && length >= 0 ? length : null
}

function getUtf8ByteLength(value: string) {
	return new TextEncoder().encode(value).byteLength
}

function parseLimitedJsonText(body: string, maxBytes: number) {
	if (getUtf8ByteLength(body) > maxBytes) {
		throw new JsonRequestBodyTooLargeError()
	}
	return JSON.parse(body)
}

export async function readLimitedJsonRequest(request: Request, maxBytes: number): Promise<unknown> {
	const contentLength = getJsonRequestContentLength(request)
	if (contentLength !== null && contentLength > maxBytes) {
		throw new JsonRequestBodyTooLargeError()
	}

	if (!('body' in request) || !request.body) {
		return parseLimitedJsonText(await request.text(), maxBytes)
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
