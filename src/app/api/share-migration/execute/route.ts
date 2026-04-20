import { NextResponse } from 'next/server'

import { executeRoute } from '../route-handlers.ts'

export async function POST(request: Request) {
  const parsedBody = await request.json().catch(() => undefined)
  const body = parsedBody !== null && typeof parsedBody === 'object' ? parsedBody : {}
  const result = await executeRoute({
    nodeEnv: process.env.NODE_ENV ?? 'production',
    confirmed: body.confirmed,
    baseDir: process.cwd()
  })

  return NextResponse.json(result.body, { status: result.status })
}
