import fs from 'fs/promises'
import path from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function handleConfigPost(request: NextRequest) {
	try {
		const { siteContent, cardStyles, customComponents, colorPresets } = await request.json()

		const configDir = path.join(process.cwd(), 'src/config')

		if (siteContent) {
			await fs.writeFile(path.join(configDir, 'site-content.json'), JSON.stringify(siteContent, null, '\t'))
		}

		if (cardStyles) {
			await fs.writeFile(path.join(configDir, 'card-styles.json'), JSON.stringify(cardStyles, null, '\t'))
		}

		if (customComponents) {
			await fs.writeFile(path.join(configDir, 'custom-components.json'), JSON.stringify(customComponents, null, '\t'))
		}

		if (colorPresets) {
			await fs.writeFile(path.join(configDir, 'color-presets.json'), JSON.stringify(colorPresets, null, '\t'))
		}

		return NextResponse.json({ success: true })
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
}
