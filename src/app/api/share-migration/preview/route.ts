import { NextResponse } from 'next/server'

import { previewRoute } from '../route-handlers.ts'

export async function GET() {
  const result = await previewRoute({
    nodeEnv: process.env.NODE_ENV ?? 'production',
    baseDir: process.cwd()
  })

  return NextResponse.json(result.body, { status: result.status })
}
