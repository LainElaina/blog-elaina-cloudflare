import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const LAYOUT_PATH = path.join(process.cwd(), 'src/config/card-styles.json')
const BACKUP_PATH = path.join(process.cwd(), 'data/layout.bak.json')

export async function GET() {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	try {
		const data = fs.readFileSync(LAYOUT_PATH, 'utf-8')
		return NextResponse.json(JSON.parse(data))
	} catch (error) {
		return NextResponse.json({ error: 'Failed to read layout' }, { status: 500 })
	}
}

export async function POST(request: Request) {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
	}

	try {
		const layout = await request.json()

		// 备份当前版本
		if (fs.existsSync(LAYOUT_PATH)) {
			const dataDir = path.join(process.cwd(), 'data')
			if (!fs.existsSync(dataDir)) {
				fs.mkdirSync(dataDir, { recursive: true })
			}
			const current = fs.readFileSync(LAYOUT_PATH, 'utf-8')
			fs.writeFileSync(BACKUP_PATH, current)
		}

		// 保存新布局
		fs.writeFileSync(LAYOUT_PATH, JSON.stringify(layout, null, '\t'))

		return NextResponse.json({ success: true })
	} catch (error) {
		return NextResponse.json({ error: 'Failed to save layout' }, { status: 500 })
	}
}
