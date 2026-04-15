import { NextResponse } from 'next/server'

import { executeRoute } from '../route-handlers.ts'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { confirmed?: boolean }
  const result = await executeRoute({
    nodeEnv: process.env.NODE_ENV ?? 'production',
    confirmed: body.confirmed === true,
    baseDir: process.cwd()
  })

  return NextResponse.json(result.body, { status: result.status })
}
