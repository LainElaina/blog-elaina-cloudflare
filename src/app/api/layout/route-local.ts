import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

const LAYOUT_PATH = path.join(process.cwd(), 'src/config/card-styles.json')
const BACKUP_PATH = path.join(process.cwd(), 'data/layout.bak.json')

export async function handleLayoutGet() {
	try {
		const data = fs.readFileSync(LAYOUT_PATH, 'utf-8')
		return NextResponse.json(JSON.parse(data))
	} catch (error) {
		return NextResponse.json({ error: 'Failed to read layout' }, { status: 500 })
	}
}

export async function handleLayoutPost(request: Request) {
	try {
		const layout = await request.json()

		if (fs.existsSync(LAYOUT_PATH)) {
			const dataDir = path.join(process.cwd(), 'data')
			if (!fs.existsSync(dataDir)) {
				fs.mkdirSync(dataDir, { recursive: true })
			}
			const current = fs.readFileSync(LAYOUT_PATH, 'utf-8')
			fs.writeFileSync(BACKUP_PATH, current)
		}

		fs.writeFileSync(LAYOUT_PATH, JSON.stringify(layout, null, '\t'))

		return NextResponse.json({ success: true })
	} catch (error) {
		return NextResponse.json({ error: 'Failed to save layout' }, { status: 500 })
	}
}
