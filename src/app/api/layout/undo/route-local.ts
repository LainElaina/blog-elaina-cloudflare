import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { isValidLayoutConfig } from '../layout-config-validation'

function getLayoutPath() {
	return path.join(process.cwd(), 'src/config/card-styles.json')
}

function getBackupPath() {
	return path.join(process.cwd(), 'data/layout.bak.json')
}

function buildAtomicLayoutUndoTempPath(fullPath: string) {
	return `${fullPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function writeFileAtomically(fullPath: string, content: string) {
	const tempPath = buildAtomicLayoutUndoTempPath(fullPath)
	try {
		fs.writeFileSync(tempPath, content, 'utf-8')
		fs.renameSync(tempPath, fullPath)
	} catch (error) {
		fs.rmSync(tempPath, { force: true })
		throw error
	}
}

export async function handleLayoutUndoPost() {
	try {
		const layoutPath = getLayoutPath()
		const backupPath = getBackupPath()
		if (!fs.existsSync(backupPath)) {
			return NextResponse.json({ error: 'No backup found' }, { status: 404 })
		}

		const backup = fs.readFileSync(backupPath, 'utf-8')
		let parsedBackup: unknown
		try {
			parsedBackup = JSON.parse(backup)
		} catch {
			return NextResponse.json({ error: '备份布局配置格式错误' }, { status: 400 })
		}
		if (!isValidLayoutConfig(parsedBackup)) {
			return NextResponse.json({ error: '备份布局配置格式错误' }, { status: 400 })
		}

		writeFileAtomically(layoutPath, backup)

		return NextResponse.json({ success: true })
	} catch (error) {
		return NextResponse.json({ error: 'Failed to undo' }, { status: 500 })
	}
}
