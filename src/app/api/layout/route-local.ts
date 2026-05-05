import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

const LAYOUT_PATH = path.join(process.cwd(), 'src/config/card-styles.json')
const BACKUP_PATH = path.join(process.cwd(), 'data/layout.bak.json')

function buildAtomicLayoutTempPath(fullPath: string) {
	return `${fullPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function writeFileAtomically(fullPath: string, content: string) {
	const tempPath = buildAtomicLayoutTempPath(fullPath)
	try {
		fs.writeFileSync(tempPath, content, 'utf-8')
		fs.renameSync(tempPath, fullPath)
	} catch (error) {
		fs.rmSync(tempPath, { force: true })
		throw error
	}
}

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
		let layout: unknown
		try {
			layout = await request.json()
		} catch {
			return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
		}

		if (fs.existsSync(LAYOUT_PATH)) {
			const dataDir = path.join(process.cwd(), 'data')
			if (!fs.existsSync(dataDir)) {
				fs.mkdirSync(dataDir, { recursive: true })
			}
			const current = fs.readFileSync(LAYOUT_PATH, 'utf-8')
			writeFileAtomically(BACKUP_PATH, current)
		}

		writeFileAtomically(LAYOUT_PATH, JSON.stringify(layout, null, '\t'))

		return NextResponse.json({ success: true })
	} catch (error) {
		return NextResponse.json({ error: 'Failed to save layout' }, { status: 500 })
	}
}
