import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	try {
		const { siteContent, cardStyles, customComponents } = await request.json()

		const configDir = path.join(process.cwd(), 'src/config')

		await fs.writeFile(
			path.join(configDir, 'site-content.json'),
			JSON.stringify(siteContent, null, '\t')
		)

		await fs.writeFile(
			path.join(configDir, 'card-styles.json'),
			JSON.stringify(cardStyles, null, '\t')
		)

		if (customComponents) {
			await fs.writeFile(
				path.join(configDir, 'custom-components.json'),
				JSON.stringify(customComponents, null, '\t')
			)
		}

		return NextResponse.json({ success: true })
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
}
