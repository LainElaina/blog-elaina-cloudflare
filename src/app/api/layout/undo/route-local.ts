import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

const LAYOUT_PATH = path.join(process.cwd(), 'src/config/card-styles.json')
const BACKUP_PATH = path.join(process.cwd(), 'data/layout.bak.json')

export async function handleLayoutUndoPost() {
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
