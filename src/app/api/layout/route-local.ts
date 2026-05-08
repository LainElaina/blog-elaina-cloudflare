import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { getLimitedJsonRequestErrorStatus, isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../limited-json-request.ts'
import { assertSafeSiteConfigProjectPath, isSiteConfigLocalValidationError } from '../site-config-local-shared.ts'
import { isValidLayoutConfig } from './layout-config-validation.ts'

export { isValidLayoutConfig } from './layout-config-validation.ts'

const LAYOUT_REQUEST_MAX_BYTES = 1024 * 1024

function getLayoutPath() {
	return path.join(process.cwd(), 'src/config/card-styles.json')
}

function getBackupPath() {
	return path.join(process.cwd(), 'data/layout.bak.json')
}

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
		const data = fs.readFileSync(getLayoutPath(), 'utf-8')
		return NextResponse.json(JSON.parse(data))
	} catch (error) {
		return NextResponse.json({ error: 'Failed to read layout' }, { status: 500 })
	}
}

export async function handleLayoutPost(request: Request) {
	try {
		let layout: unknown
		try {
			layout = await readLimitedJsonRequest(request, LAYOUT_REQUEST_MAX_BYTES)
		} catch (error) {
			return NextResponse.json(
				{ error: isJsonRequestBodyTooLargeError(error) ? '请求体过大' : '请求体格式错误' },
				{ status: getLimitedJsonRequestErrorStatus(error) }
			)
		}
		if (!isValidLayoutConfig(layout)) {
			return NextResponse.json({ error: '布局配置格式错误' }, { status: 400 })
		}

		const layoutPath = getLayoutPath()
		const backupPath = getBackupPath()
		await assertSafeSiteConfigProjectPath(process.cwd(), layoutPath)
		await assertSafeSiteConfigProjectPath(process.cwd(), backupPath)
		if (fs.existsSync(layoutPath)) {
			const dataDir = path.join(process.cwd(), 'data')
			if (!fs.existsSync(dataDir)) {
				fs.mkdirSync(dataDir, { recursive: true })
			}
			const current = fs.readFileSync(layoutPath, 'utf-8')
			writeFileAtomically(backupPath, current)
		}

		writeFileAtomically(layoutPath, JSON.stringify(layout, null, '\t'))

		return NextResponse.json({ success: true })
	} catch (error) {
		return NextResponse.json({ error: 'Failed to save layout' }, { status: isSiteConfigLocalValidationError(error) ? 400 : 500 })
	}
}
