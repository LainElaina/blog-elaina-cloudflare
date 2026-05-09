import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { assertSafeSiteConfigProjectPath, isSiteConfigLocalValidationError, withSiteConfigLocalMutationLock, writeSiteConfigFileAtomically } from '../../site-config-local-shared.ts'
import { isValidLayoutConfig } from '../layout-config-validation.ts'

function getLayoutPath() {
	return path.join(process.cwd(), 'src/config/card-styles.json')
}

function getBackupPath() {
	return path.join(process.cwd(), 'data/layout.bak.json')
}

class LayoutBackupMissingError extends Error {}

class LayoutBackupInvalidError extends Error {}

export async function handleLayoutUndoPost() {
	try {
		await withSiteConfigLocalMutationLock(process.cwd(), async () => {
			const layoutPath = getLayoutPath()
			const backupPath = getBackupPath()
			await assertSafeSiteConfigProjectPath(process.cwd(), layoutPath)
			await assertSafeSiteConfigProjectPath(process.cwd(), backupPath)
			if (!fs.existsSync(backupPath)) {
				throw new LayoutBackupMissingError()
			}

			const backup = fs.readFileSync(backupPath, 'utf-8')
			let parsedBackup: unknown
			try {
				parsedBackup = JSON.parse(backup)
			} catch {
				throw new LayoutBackupInvalidError()
			}
			if (!isValidLayoutConfig(parsedBackup)) {
				throw new LayoutBackupInvalidError()
			}

			await writeSiteConfigFileAtomically(layoutPath, backup)
		})

		return NextResponse.json({ success: true })
	} catch (error) {
		if (error instanceof LayoutBackupMissingError) {
			return NextResponse.json({ error: 'No backup found' }, { status: 404 })
		}
		if (error instanceof LayoutBackupInvalidError) {
			return NextResponse.json({ error: '备份布局配置格式错误' }, { status: 400 })
		}
		if (isSiteConfigLocalValidationError(error)) {
			return NextResponse.json({ error: error.message }, { status: 400 })
		}
		return NextResponse.json({ error: 'Failed to undo' }, { status: 500 })
	}
}
