import { NextResponse } from 'next/server'
import { isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../../limited-json-request.ts'
import { rejectNonLocalDevelopmentRequest } from '../../local-development-request.ts'

const MAX_BLOG_MIGRATION_EXECUTE_REQUEST_BODY_SIZE = 1024 * 1024

export async function POST(request: Request) {
	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	let rawBody: unknown
	try {
		rawBody = await readLimitedJsonRequest(request, MAX_BLOG_MIGRATION_EXECUTE_REQUEST_BODY_SIZE)
	} catch (error) {
		if (isJsonRequestBodyTooLargeError(error)) {
			return NextResponse.json({ message: '请求体超过 1MB 限制' }, { status: 413 })
		}
		return NextResponse.json({ message: '请求 JSON 格式错误' }, { status: 400 })
	}
	const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as { confirmed?: boolean; snapshotHash?: unknown }
	const { executeRoute } = await import('../route-handlers.ts')
	const result = await executeRoute({
		nodeEnv: 'development',
		confirmed: body.confirmed === true,
		snapshotHash: typeof body.snapshotHash === 'string' ? body.snapshotHash : undefined,
		baseDir: process.cwd()
	})

	return NextResponse.json(result.body, { status: result.status })
}
