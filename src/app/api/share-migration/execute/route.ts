import { NextResponse } from 'next/server'
import { isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../../limited-json-request.ts'
import { rejectNonLocalDevelopmentRequest, rejectUnavailableLocalDevelopmentRequest } from '../../local-development-request.ts'

import { buildShareMigrationFailureResponse } from '../share-migration-api-contracts.ts'

const MAX_SHARE_MIGRATION_EXECUTE_REQUEST_BODY_SIZE = 1024 * 1024

function buildRequestBodyTooLargeResponse() {
	return buildShareMigrationFailureResponse({
		operation: 'execute',
		code: 'REQUEST_BODY_TOO_LARGE',
		message: '请求体超过 1MB 限制'
	})
}

export async function POST(request: Request) {
	if (process.env.NODE_ENV !== 'development') {
		return rejectUnavailableLocalDevelopmentRequest()
	}

	const rejected = rejectNonLocalDevelopmentRequest(request)
	if (rejected) {
		return rejected
	}

	let rawBody: unknown
	try {
		rawBody = await readLimitedJsonRequest(request, MAX_SHARE_MIGRATION_EXECUTE_REQUEST_BODY_SIZE)
	} catch (error) {
		if (isJsonRequestBodyTooLargeError(error)) {
			return NextResponse.json(buildRequestBodyTooLargeResponse(), { status: 413 })
		}
		return NextResponse.json(
			buildShareMigrationFailureResponse({
				operation: 'execute',
				code: 'INVALID_REQUEST_JSON',
				message: '请求 JSON 格式错误'
			}),
			{ status: 400 }
		)
	}
	const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as { confirmed?: boolean; snapshotHash?: unknown }
	const { executeRoute } = await import('../route-handlers.ts')
	const result = await executeRoute({
		nodeEnv: process.env.NODE_ENV,
		confirmed: body.confirmed === true,
		snapshotHash: typeof body.snapshotHash === 'string' ? body.snapshotHash : undefined,
		baseDir: process.cwd()
	})

	return NextResponse.json(result.body, { status: result.status })
}
