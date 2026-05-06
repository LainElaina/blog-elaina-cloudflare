import fs from 'fs/promises'
import path from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../limited-json-request'
import { isValidLayoutConfig } from '../layout/layout-config-validation'

const SITE_CONFIG_REQUEST_MAX_BYTES = 1024 * 1024

const CARD_STYLES_FILE_NAME = 'card-styles.json'
const LAYOUT_BACKUP_PATH = path.join(process.cwd(), 'data/layout.bak.json')
const CONFIG_WRITE_KEYS = new Set(['siteContent', 'cardStyles', 'customComponents', 'colorPresets'])

function buildAtomicConfigTempPath(fullPath: string) {
	return `${fullPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function writeFileAtomically(fullPath: string, content: string) {
	const tempPath = buildAtomicConfigTempPath(fullPath)
	try {
		await fs.writeFile(tempPath, content)
		await fs.rename(tempPath, fullPath)
	} catch (error) {
		await fs.rm(tempPath, { force: true }).catch(() => undefined)
		throw error
	}
}

type ConfigWrite = {
	fileName: string
	content: string
}

type ConfigBackup = {
	filePath: string
	existed: boolean
	content: string
}

function isFileNotFoundError(error: unknown) {
	return Boolean(error) && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
}

async function readConfigBackup(filePath: string): Promise<ConfigBackup> {
	try {
		return {
			filePath,
			existed: true,
			content: await fs.readFile(filePath, 'utf-8')
		}
	} catch (error) {
		if (isFileNotFoundError(error)) {
			return { filePath, existed: false, content: '' }
		}
		throw error
	}
}

async function rollbackConfigWrites(backups: ConfigBackup[]) {
	for (const backup of backups.reverse()) {
		if (backup.existed) {
			await writeFileAtomically(backup.filePath, backup.content).catch(() => undefined)
		} else {
			await fs.rm(backup.filePath, { force: true }).catch(() => undefined)
		}
	}
}

function hasOnlyConfigWriteKeys(payload: Record<string, unknown>) {
	return Object.keys(payload).every(key => CONFIG_WRITE_KEYS.has(key))
}

function assertConfigPayloadShape(payload: { cardStyles?: unknown }) {
	if (payload.cardStyles !== undefined && !isValidLayoutConfig(payload.cardStyles)) {
		return NextResponse.json({ error: '卡片布局配置格式错误' }, { status: 400 })
	}
	return null
}

function buildConfigWrites(payload: { siteContent?: unknown; cardStyles?: unknown; customComponents?: unknown; colorPresets?: unknown }): ConfigWrite[] {
	const writes: ConfigWrite[] = []
	if (payload.siteContent) {
		writes.push({ fileName: 'site-content.json', content: JSON.stringify(payload.siteContent, null, '\t') })
	}
	if (payload.cardStyles) {
		writes.push({ fileName: CARD_STYLES_FILE_NAME, content: JSON.stringify(payload.cardStyles, null, '\t') })
	}
	if (payload.customComponents !== undefined) {
		writes.push({ fileName: 'custom-components.json', content: JSON.stringify(payload.customComponents, null, '\t') })
	}
	if (payload.colorPresets !== undefined) {
		writes.push({ fileName: 'color-presets.json', content: JSON.stringify(payload.colorPresets, null, '\t') })
	}
	return writes
}

async function writeLayoutBackupIfNeeded(writes: ConfigWrite[], backups: ConfigBackup[]) {
	const cardStylesBackup = backups.find(backup => path.basename(backup.filePath) === CARD_STYLES_FILE_NAME)
	if (!cardStylesBackup || !cardStylesBackup.existed || !writes.some(write => write.fileName === CARD_STYLES_FILE_NAME)) {
		return
	}

	await fs.mkdir(path.dirname(LAYOUT_BACKUP_PATH), { recursive: true })
	await writeFileAtomically(LAYOUT_BACKUP_PATH, cardStylesBackup.content)
}

export async function handleConfigPost(request: NextRequest) {
	try {
		let payload: unknown
		try {
			payload = await readLimitedJsonRequest(request, SITE_CONFIG_REQUEST_MAX_BYTES)
		} catch (error) {
			return NextResponse.json({ error: isJsonRequestBodyTooLargeError(error) ? '请求体过大' : '请求体格式错误' }, { status: 400 })
		}
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
		}

		if (!hasOnlyConfigWriteKeys(payload as Record<string, unknown>)) {
			return NextResponse.json({ error: '请求体包含未知配置项' }, { status: 400 })
		}

		const shapeErrorResponse = assertConfigPayloadShape(payload as { cardStyles?: unknown })
		if (shapeErrorResponse) {
			return shapeErrorResponse
		}

		const configDir = path.join(process.cwd(), 'src/config')
		const writes = buildConfigWrites(payload)
		if (writes.length === 0) {
			return NextResponse.json({ error: '缺少可写配置项' }, { status: 400 })
		}
		const backups: ConfigBackup[] = []

		try {
			for (const write of writes) {
				const filePath = path.join(configDir, write.fileName)
				backups.push(await readConfigBackup(filePath))
				await writeFileAtomically(filePath, write.content)
			}
			await writeLayoutBackupIfNeeded(writes, backups)
		} catch (error) {
			await rollbackConfigWrites(backups)
			throw error
		}

		return NextResponse.json({ success: true })
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
}
