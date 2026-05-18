import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { getLimitedJsonRequestErrorStatus, isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../limited-json-request.ts'
import { assertSafeSiteConfigProjectPath, isSiteConfigLocalValidationError, withSiteConfigLocalMutationLock, writeSiteConfigFileAtomically } from '../site-config-local-shared.ts'
import { isValidLayoutConfig } from './layout-config-validation.ts'

export { isValidLayoutConfig } from './layout-config-validation.ts'

const LAYOUT_REQUEST_MAX_BYTES = 1024 * 1024

function getLayoutPath() {
	return path.join(process.cwd(), 'src/config/card-styles.json')
}

function getBackupPath() {
	return path.join(process.cwd(), 'data/layout.bak.json')
}

function isFileNotFoundError(error: unknown) {
	return error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
}

export async function handleLayoutGet() {
	try {
		const layoutPath = getLayoutPath()
		await assertSafeSiteConfigProjectPath(process.cwd(), layoutPath)
		const data = fs.readFileSync(layoutPath, 'utf-8')
		let layout: unknown
		try {
			layout = JSON.parse(data)
		} catch (error) {
			if (error instanceof SyntaxError) {
				return NextResponse.json({ error: '布局配置解析失败，请修复 src/config/card-styles.json 后重试' }, { status: 400 })
			}
			throw error
		}
		if (!isValidLayoutConfig(layout)) {
			return NextResponse.json({ error: '布局配置格式错误' }, { status: 400 })
		}
		return NextResponse.json(layout)
	} catch (error) {
		if (isSiteConfigLocalValidationError(error)) {
			return NextResponse.json({ error: 'Failed to read layout' }, { status: 400 })
		}
		if (isFileNotFoundError(error)) {
			return NextResponse.json({ error: '布局配置文件不存在' }, { status: 404 })
		}
		const details = error instanceof Error ? error.message : String(error)
		return NextResponse.json({ error: `Failed to read layout: ${details}` }, { status: 500 })
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

		await withSiteConfigLocalMutationLock(process.cwd(), async () => {
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
				await writeSiteConfigFileAtomically(backupPath, current)
			}

			await writeSiteConfigFileAtomically(layoutPath, JSON.stringify(layout, null, '\t'))
		})

		return NextResponse.json({ success: true })
	} catch (error) {
		if (isSiteConfigLocalValidationError(error)) {
			return NextResponse.json({ error: 'Failed to save layout' }, { status: 400 })
		}
		const details = error instanceof Error ? error.message : String(error)
		return NextResponse.json({ error: `Failed to save layout: ${details}` }, { status: 500 })
	}
}
