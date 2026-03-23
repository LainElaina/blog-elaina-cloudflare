import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const LAYOUT_PATH = path.join(process.cwd(), 'src/config/card-styles.json')
const BACKUP_PATH = path.join(process.cwd(), 'data/layout.bak.json')

export async function POST() {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	try {
		if (!fs.existsSync(BACKUP_PATH)) {
			return NextResponse.json({ error: 'No backup found' }, { status: 404 })
		}

		const backup = fs.readFileSync(BACKUP_PATH, 'utf-8')
		fs.writeFileSync(LAYOUT_PATH, backup)

		return NextResponse.json({ success: true })
	} catch (error) {
		return NextResponse.json({ error: 'Failed to undo' }, { status: 500 })
	}
}
